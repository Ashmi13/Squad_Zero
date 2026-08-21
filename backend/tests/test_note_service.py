from unittest.mock import MagicMock, patch
from m3_structurednotes.services import NoteService

@patch('m3_structurednotes.services.psycopg2.connect')
def test_save_note_to_db_success(mock_connect):
    # Setup mock connection and cursor
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_connect.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    
    # Instantiate service with dummy URL
    service = NoteService(db_url="postgresql://mock_db")
    
    # Call save_note_to_db
    note_id = service.save_note_to_db(
        user_id="user-123",
        pdf_id="pdf-456",
        title="My Notes",
        content="Some markdown content"
    )
    
    # Assert a UUID is returned
    assert note_id is not None
    assert len(note_id) == 36
    
    # Verify queries were run
    assert mock_cur.execute.called
