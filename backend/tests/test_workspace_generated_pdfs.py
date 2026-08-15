from app.services.workspace_service import WorkspaceService
from app.services import workspace_service as workspace_service_module


class FakeResponse:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, rows=None):
        self.rows = rows or []
        self._payload = None
        self._filters = []

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        self._filters.append(args)
        return self

    def in_(self, *args, **kwargs):
        self._filters.append(args)
        return self

    def limit(self, *args, **kwargs):
        return self

    def insert(self, payload):
        self._payload = payload
        return self

    def update(self, payload):
        self._payload = payload
        return self

    def execute(self):
        if self._payload is not None:
            return FakeResponse([self._payload])
        return FakeResponse(self.rows)


class FakeSupabase:
    def __init__(self):
        self.files_table = FakeTable([
            {
                "id": "file-1",
                "user_id": "user-1",
                "folder_id": "folder-1",
                "name": "Original",
                "file_type": "PDF",
                "mime_type": "application/pdf",
                "storage_path": "workspace/user-1/folder-1/original.pdf",
            }
        ])

    def table(self, name):
        if name == "files":
            return self.files_table
        return FakeTable([])


def test_generate_pdf_document_uses_pdf_mime_and_signature():
    pdf_bytes = WorkspaceService.generate_pdf_document("Extracted", "hello world")

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 1000


def test_create_generated_pdf_file_persists_pdf_metadata():
    workspace_service_module._COLUMNS_DETECTED = False
    workspace_service_module._COLUMNS_CACHE = {
        "user_id": True,
        "folder_id": True,
        "parent_file_id": True,
        "name": True,
        "original_filename": True,
        "file_type": True,
        "mime_type": True,
        "size_bytes": True,
        "storage_path": True,
    }

    fake_supabase = FakeSupabase()
    service = WorkspaceService(fake_supabase)
    generated = service.create_generated_pdf_file(
        user_id="user-1",
        folder_id="folder-1",
        parent_file_id="file-1",
        name="Original - Extracted",
        content="hello world",
        original_filename="Original - Extracted.pdf",
    )

    assert generated["file_type"] == "PDF"
    assert generated["mime_type"] == "application/pdf"
    assert generated["folder_id"] == "folder-1"
    assert generated["parent_file_id"] == "file-1"
    assert generated["storage_path"].endswith(".pdf")
