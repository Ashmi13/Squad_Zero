import { useState } from "react";

export default function UploadMaterial() {
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [file, setFile] = useState(null);

  return (
    <div className="card flex flex-col gap-md">
      <h2>Upload Material</h2>

      <div className="flex flex-col gap-sm">
        <label className="text-muted" style={{ fontSize: '0.9rem' }}>Title</label>
        <input
          type="text"
          placeholder="Enter material title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-sm">
        <label className="text-muted" style={{ fontSize: '0.9rem' }}>Instructions</label>
        <textarea
          rows={4}
          placeholder="Provide instructions for AI..."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-sm">
        <label className="text-muted" style={{ fontSize: '0.9rem' }}>Attachment</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ padding: 'var(--spacing-sm)' }}
        />
        {file && <small className="text-muted">Selected: {file.name}</small>}
      </div>

      <button style={{ marginTop: 'var(--spacing-md)' }}>
        Upload Material
      </button>
    </div>
  );
}
