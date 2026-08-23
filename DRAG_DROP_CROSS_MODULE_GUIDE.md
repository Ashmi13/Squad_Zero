# Drag-and-Drop & Cross-Module File Access Guide

## Overview
This document describes the new drag-and-drop file moving functionality and cross-module file access capabilities implemented for NeuraNote.

---

## 1. Drag-and-Drop File Moving

### User Experience

#### Moving Files Between Folders
1. **Open File Manager** → Select a folder in the left panel
2. **Drag a file** from the file list → The file becomes semi-transparent (50% opacity)
3. **Drag over a folder** in the left panel → Folder highlights with purple background (#e8deff)
4. **Drop the file** → File moves to the target folder
5. **Status message** appears confirming the move or showing any errors

#### Visual Feedback
- **File being dragged:** Semi-transparent (opacity: 0.5), light gray background
- **Folder as drop target:** Purple background highlight, bold folder name
- **Success:** Green status message "File moved successfully!"
- **Error:** Red status message with error details

### Technical Implementation

**Frontend Components:**
- `FileList.jsx`: Added drag handlers to FileRow component
- `FolderPanel.jsx`: Added drop zone handlers to folder items
- State tracking for drag-over folders and moving status

**Backend:**
- `PATCH /api/v1/workspace/files/{file_id}/move` endpoint (already existed)
- Updates `files.folder_id` in database
- No file copying - just metadata update

**API Call:**
```javascript
workspaceApi.moveFile(fileId, targetFolderId)
  .then(() => {
    // Reload files in both source and target folders
    // Show success message
  })
  .catch(error => {
    // Show error message
  })
```

---

## 2. Cross-Module File Access

### Architecture

**Three-Layer Pattern:**
1. **Workspace Module** → Central file storage (all files)
2. **Access APIs** → Query/export endpoints (other modules access here)
3. **Other Modules** → Quiz, Structured Notes, etc. can browse and reference files

### Available Endpoints

#### Search Files
```
GET /api/v1/workspace/files/search?query=<text>&file_type=<type>&limit=<num>
```

**Parameters:**
- `query` (string): Search by file name (partial match, case-insensitive)
- `file_type` (string): Filter by type (PDF, TXT, DOCX, etc.)
- `limit` (integer): Max results (default: 20)

**Response:**
```json
{
  "files": [
    {
      "id": "file-uuid",
      "name": "lecture-notes.pdf",
      "file_type": "PDF",
      "storage_url": "https://...",
      "storage_path": "workspace/user-id/folder-id/file.pdf",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

#### Export File to Module
```
POST /api/v1/workspace/files/{file_id}/export-to-module
Body:
  - module_name: "quiz" | "structured_notes" | "custom_module"
  - module_ref_id (optional): Reference ID in target module
```

**Response:**
```json
{
  "status": "success",
  "message": "File exported to quiz",
  "file": {
    "id": "file-uuid",
    "name": "lecture-notes.pdf",
    "file_type": "PDF",
    "storage_url": "https://...",
    "storage_path": "workspace/user-id/folder-id/file.pdf",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

### Frontend API Methods

**JavaScript/React:**
```javascript
import { workspaceApi } from '@/services/workspaceApi';

// Search for files
const result = await workspaceApi.searchFiles(
  query = "lecture",
  fileType = "PDF",
  limit = 20
);
// result: { files: [...], count: N }

// Export file to another module
const exportResult = await workspaceApi.exportFileToModule(
  fileId = "uuid",
  moduleName = "quiz",
  moduleRefId = "optional-ref-id"
);
// exportResult: { status, message, file, reference }
```

---

## 3. File Persistence in Supabase Storage

### Storage Location
All uploaded files are stored in Supabase Storage:

**Bucket:** `workspace-files` (configurable via `SUPABASE_STORAGE_BUCKET`)

**Object Key Pattern:**
```
workspace/{user_id}/{folder_id}/{uuid}.{extension}
```

**Example:**
```
workspace/user-123/folder-456/a1b2c3d4e5f6.pdf
```

### Database Metadata
File metadata stored in `files` table:
- `id`: UUID of the file record
- `user_id`: Owner user ID
- `folder_id`: Parent folder ID
- `name`: File name (without extension)
- `original_filename`: Full name with extension
- `file_type`: Uppercase type (PDF, TXT, DOCX)
- `storage_url`: Public or signed URL to file in storage
- `storage_path`: Object key for storage
- `mime_type`: Content type
- `size_bytes`: File size
- `created_at`: Upload timestamp
- `last_accessed`: Last access timestamp (updated via PATCH)
- `file_content`: (Optional) Cached content for text files or data URLs

### Multi-Column Fallback
If `storage_url` is unavailable, files can still be previewed via:
1. `file_content` (text or data URL)
2. `raw_text` (generated/extracted text)
3. `text`, `content`, `summary` (legacy fields)

This ensures previews work even if external storage is temporarily unavailable.

### Signed URLs
Signed URLs are generated with 1-hour expiry:
```javascript
const preview = await workspaceApi.getFilePreview(fileId, expiresIn = 3600);
// response: { preview: "signed-url-or-data-url" }
```

**Auto-Renewal:**
File access timestamps are updated automatically via:
```
PATCH /api/v1/workspace/files/{file_id}/access
```

This ensures recently-accessed files have valid signed URLs when accessed again.

---

## 4. Module Integration

### How Other Modules Access Workspace Files

**Step-by-Step:**

1. **Quiz Module** wants to let users import workspace files:
   ```javascript
   // In QuizHomePage.jsx or new component
   const handleBrowseWorkspaceFiles = async () => {
     const result = await workspaceApi.searchFiles("", "PDF", 50);
     // Display files to user
     // User selects file
     // Upload handler processes selected file like normal upload
   };
   ```

2. **Structured Notes** wants to reference workspace files:
   ```javascript
   // In UploadSection.jsx
   const handleImportFromWorkspace = async () => {
     const result = await workspaceApi.searchFiles("", null, 100);
     // Filter for .md, .txt, .pdf
     // User selects file
     // Call exportFileToModule("file-id", "structured_notes")
     // Fetch file content via storage_url
   };
   ```

3. **Any Custom Module:**
   ```javascript
   // Search for specific file types
   const files = await workspaceApi.searchFiles(
     query = "keyword",
     fileType = "PDF"
   );
   
   // Export file to track reference
   await workspaceApi.exportFileToModule(
     fileId,
     moduleName = "my_custom_module"
   );
   
   // Access file using storage_url or storage_path
   const response = await fetch(file.storage_url);
   const content = await response.text(); // or .blob(), .arrayBuffer()
   ```

### Example: Adding File Browse to Quiz

**Proposed UI Change (QuizHomePage.jsx):**
```jsx
<div className="upload-section">
  <button onClick={handleBrowseWorkspaceFiles}>
    📁 Browse Workspace Files
  </button>
  
  {workspaceFiles && (
    <div className="workspace-files-list">
      {workspaceFiles.map(file => (
        <div key={file.id} className="file-item">
          <span>{file.name}</span>
          <button onClick={() => selectWorkspaceFile(file)}>
            Add to Quiz
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

**Implementation:**
```javascript
const selectWorkspaceFile = async (file) => {
  // Fetch file content from storage_url
  const response = await fetch(file.storage_url);
  const blob = await response.blob();
  
  // Add to uploadedFiles like normal upload
  const virtualFile = new File([blob], file.name, {
    type: file.mime_type || 'application/octet-stream'
  });
  
  handleFiles([virtualFile]);
  
  // Track in workspace module
  await workspaceApi.exportFileToModule(file.id, 'quiz');
};
```

---

## 5. File Opening and Preview

### When User Clicks a File

1. **Frontend** calls `workspaceApi.getFilePreview(fileId)`
2. **Backend** resolves preview URL:
   - Check `storage_url` → Generate signed URL if needed
   - Fallback to `file_content` (data URL or text)
   - Fallback to legacy columns (raw_text, summary, etc.)
3. **Frontend** displays file:
   - PDF: Render using pdf.js or embed
   - Text: Show in editor/viewer
   - Image: Display as <img>
   - Binary: Show download option

### Persistence After Login/Merge

**Files persist because:**
1. ✅ Stored in Supabase Storage (persistent across sessions)
2. ✅ Metadata in PostgreSQL database (survives merges)
3. ✅ Signed URLs regenerated on access (auto-refresh)
4. ✅ User ID associated with all files (proper isolation)

**Testing:**
1. Upload file → Verify in Supabase Storage bucket
2. Logout → Login with same user
3. File still visible in folder
4. Click file → Verify it opens correctly
5. Deploy code merge → File still accessible

---

## 6. Configuration

### Backend (.env)
```env
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=workspace-files
```

### Frontend (.env or config)
```
VITE_API_BASE_URL=http://localhost:8000
```

### Database
No special configuration needed if tables exist:
- `folders` (with user_id, parent_folder_id or parent_id)
- `files` (with user_id, folder_id, storage_url, storage_path)

---

## 7. Troubleshooting

### Files Not Dragging
- ✅ Verify FileRow has `draggable` attribute
- ✅ Check browser console for JavaScript errors
- ✅ Ensure `onDragStart` handler is firing

### Drop Not Working
- ✅ Verify folder has `onDragOver`, `onDragLeave`, `onDrop` handlers
- ✅ Check that `e.preventDefault()` is called in handlers
- ✅ Verify FolderPanel is rendering correctly

### File Not Persisting After Login
- ✅ Check Supabase Storage bucket exists and file is there
- ✅ Verify `storage_url` is saved in database
- ✅ Check signed URL expiry in `.env`
- ✅ Ensure user_id matches between sessions

### Search Returns No Results
- ✅ Verify files exist in user's folders
- ✅ Check `user_id` is correctly passed
- ✅ Try searching with empty query to see all files
- ✅ Check file_type format (must be uppercase)

### Cross-Module Export Fails
- ✅ Verify `module_file_references` table exists (optional)
- ✅ Check module_name matches expected values
- ✅ Verify file_id exists and belongs to user
- ✅ Check backend logs for detailed error

---

## 8. Future Enhancements

1. **Batch Drag-Drop**: Move multiple files simultaneously
2. **File Sharing**: Cross-user file references (with permissions)
3. **File Versioning**: Track versions and restore older versions
4. **Real-time Sync**: Update file lists across open tabs
5. **Advanced Search**: Filter by date, size, tags, module
6. **Smart Preview**: Auto-fetch and cache previews
7. **Module Permissions**: Control which modules can access which files
8. **Drag Between Modules**: Drag files directly from workspace into Quiz/Notes UI

---

## 9. API Reference

### Workspace File Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/workspace/folders` | List user's folders |
| POST | `/api/v1/workspace/folders` | Create folder |
| GET | `/api/v1/workspace/files` | List files in folder |
| POST | `/api/v1/workspace/files/upload` | Upload file |
| PATCH | `/api/v1/workspace/files/{id}/move` | Move file to folder |
| DELETE | `/api/v1/workspace/files/{id}` | Delete file |
| GET | `/api/v1/workspace/files/{id}/preview` | Get file preview |
| PATCH | `/api/v1/workspace/files/{id}/access` | Update access time |
| GET | `/api/v1/workspace/files/search` | Search files |
| POST | `/api/v1/workspace/files/{id}/export-to-module` | Export to module |

---

## 10. Summary

✅ **Implemented:**
- Drag-and-drop file moving between folders
- Visual feedback (drag state, drop zones)
- Cross-module file search API
- File export/linking API
- Supabase Storage persistence
- Multi-column database fallback
- Signed URL auto-renewal
- Quiz and Structured Notes access patterns

✅ **Preserved:**
- Existing routes unchanged
- Current navigation flow intact
- File preview functionality
- User authentication
- Folder hierarchy
- File type detection

✅ **Benefits:**
- Files persist across sessions and merges
- Multiple modules can access same files
- Intuitive drag-and-drop UX
- Scalable architecture for new modules
- Fallback support for incomplete schemas

---

**Questions?** See backend logs: `backend/app/services/workspace_service.py`
**Frontend code?** See: `frontend/src/components/filemanager/` and `frontend/src/services/workspaceApi.js`
