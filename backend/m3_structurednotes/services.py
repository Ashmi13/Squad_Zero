import os
import json
from PyPDF2 import PdfReader
from pptx import Presentation
from io import BytesIO
# from langchain_huggingface import HuggingFaceEmbeddings
# from langchain_groq import ChatGroq
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
from .database import get_db_connection
from psycopg2.extras import RealDictCursor
import uuid
import numpy as np

load_dotenv()

class AIService:

    def __init__(self):
        # Use HuggingFace local embeddings (free)
        self._embeddings = None
        # Use Groq for LLM (free tier)
        self._llm = None

    @property
    def embeddings(self):
        if self._embeddings is None:
            from langchain_huggingface import HuggingFaceEmbeddings
            print("Loading HuggingFace Embeddings... (First run may take a few minutes)")
            self._embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        return self._embeddings

    @property
    def llm(self):
        if self._llm is None:
            from langchain_groq import ChatGroq
            api_key = os.getenv("GROQ_API_KEY")
            self._llm = ChatGroq(
                groq_api_key=api_key, 
                model_name="llama-3.1-8b-instant",
                temperature=0
            )
        return self._llm

    def process_pdf(self, file_bytes, pdf_id, original_filename):
        # Determine file type
        is_pptx = original_filename.lower().endswith('.pptx')
        extension = ".pptx" if is_pptx else ".pdf"

        # 1. Save File to disk for viewing
        save_dir = "documents"
        os.makedirs(save_dir, exist_ok=True)
        
        safe_filename = f"{pdf_id}{extension}"
        file_path = os.path.join(save_dir, safe_filename)
        
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        # 2. Extract text
        full_text = ""
        if is_pptx:
            prs = Presentation(BytesIO(file_bytes))
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        full_text += shape.text + " "
                full_text += "\n"
        else:
            reader = PdfReader(BytesIO(file_bytes))
            for page in reader.pages:
                full_text += page.extract_text() or ""
            
        # 3. Chunk text for Vector Storage
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        chunks = text_splitter.split_text(full_text)
        
        # 4. Generate Embeddings and Save to Postgres (pgvector)
        try:
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                
                # Check if document_chunks table exists (lightweight check/fallback)
                # In production, schema migration handles this.
                
                # Generate embeddings in batch
                embeddings = self.embeddings.embed_documents(chunks)
                
                for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                    chunk_id = str(uuid.uuid4())
                    cur.execute("""
                        INSERT INTO document_chunks (id, pdf_id, chunk_index, content, embedding, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        chunk_id, 
                        pdf_id, 
                        i, 
                        chunk_text, 
                        str(embedding), # pgvector expects array/list as string representation or list
                        json.dumps({"source": original_filename})
                    ))
                
                conn.commit()
                cur.close()
                conn.close()
                print(f"Stored {len(chunks)} chunks in Postgres (pgvector) for {pdf_id}")
            else:
                print("DB Connection failed, skipping vector storage.")
                
        except Exception as e:
            print(f"Error storing vectors in Postgres: {e}")
            if conn:
                conn.rollback()
        
        # 5. Return result
        return {
            "status": "success",
            "pdf_url": f"/documents/{safe_filename}",
            "extracted_text": full_text
        }

    def save_note_to_db(self, user_id, pdf_id, title, content):
        conn = get_db_connection()
        if not conn:
            print("Database connection failed")
            return None
        
        try:
            cur = conn.cursor()
            note_id = str(uuid.uuid4())
            
            # Use pdf_id if provided (ensure column exists or handle gracefully)
            cur.execute("""
                INSERT INTO notes (note_id, user_id, title, content, created_date, updated_date, note_type, is_in_folder, has_embeddings)
                VALUES (%s, %s, %s, %s, NOW(), NOW(), 'ai_generated', FALSE, TRUE)
            """, (note_id, user_id, title, content))
            
            conn.commit()
            cur.close()
            conn.close()
            print(f"Note saved to DB: {note_id}")
            return note_id
        except Exception as e:
            print(f"Error saving to DB: {e}")
            if conn:
                conn.rollback()
            return None

        
    def generate_note(self, pdf_id, user_id, instruction=None):
        # Retrieve relevant chunks using pgvector (Cosine Similarity)
        context_text = ""
        
        try:
            # Create embedding for the instruction (query)
            # If no instruction, we might just summarization, but for now assuming instruction or generic 'summarize'
            query_text = instruction if instruction else "Summarize this document"
            query_embedding = self.embeddings.embed_query(query_text)
            
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                
                # Perform similarity search using invalid-safe syntax for pgvector
                # The <=> operator is cosine distance (lower is better)
                # We want the closest matches, so ORDER BY <=> LIMIT k
                cur.execute("""
                    SELECT content 
                    FROM document_chunks 
                    WHERE pdf_id = %s 
                    ORDER BY embedding <=> %s 
                    LIMIT 5
                """, (pdf_id, str(query_embedding)))
                
                results = cur.fetchall()
                # Sort back by chunk index if we selected widely? 
                # Actually for RAG we usually just want relevant context. 
                # If we want full doc flow, we might need a different retrieval strategy.
                # For now, relevant context is standard.
                
                context_chunks = [row[0] for row in results]
                context_text = "\n\n".join(context_chunks)
                
                cur.close()
                conn.close()
            else:
                return "Database connection failed during retrieval."

        except Exception as e:
            print(f"Error retrieving vectors: {e}")
            return f"Error exploring document: {str(e)}"

        if not context_text:
            return "No relevant content found in the document."
            
        # Create prompt for Groq
        prompt = f"""
        Instructions: {instruction if instruction else "Create a detailed study note based on the provided text."}
        
        Context (Extracted from Document):
        {context_text}
        
        Generate a comprehensive markdown note based on the context above.
        """
        
        try:
            response = self.llm.invoke(prompt)
            return response.content
        except Exception as e:
            return f"Error generating note: {str(e)}"


    def update_note(self, note_id: str, new_content: str):
        """
        Updates the content of an existing note in the database.
        """
        conn = get_db_connection()
        if not conn:
            return False
            
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE notes SET content = %s, updated_date = NOW() WHERE note_id = %s",
                (new_content, note_id)
            )
            rows_updated = cur.rowcount
            conn.commit()
            cur.close()
            conn.close()
            
            if rows_updated == 0:
                print(f"Warning: Attempted to update non-existent note {note_id}")
                return False
                
            return True
        except Exception as e:
            print(f"Error updating note: {e}")
            return False

    def refine_text(self, pdf_id: str, selected_text: str, instruction: str):
        """
        Refines or explains a specific piece of text using the original PDF context.
        """
        # 1. Retrieve relevant context from the PDF
        query_text = f"{selected_text} {instruction}"
        query_embedding = self.embeddings.embed_query(query_text)
        
        context_text = ""
        try:
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                cur.execute("""
                    SELECT content 
                    FROM document_chunks 
                    WHERE pdf_id = %s 
                    ORDER BY embedding <=> %s 
                    LIMIT 3
                """, (pdf_id, str(query_embedding)))
                
                results = cur.fetchall()
                context_chunks = [row[0] for row in results]
                context_text = "\n\n".join(context_chunks)
                cur.close()
                conn.close()
        except Exception as e:
            print(f"Error retrieving context for refinement: {e}")
            context_text = "" # Fallback to no context
        
        # 2. Prompt the LLM
        prompt = f"""
        You are an expert tutor. The user has selected a specific part of a note and asked for a modification or explanation.
        
        CONTEXT from the original document:
        {context_text}
        
        USER SELECTED TEXT: "{selected_text}"
        USER INSTRUCTION: "{instruction}"
        
        YOUR TASK:
        Provide the requested refinement, explanation, or example based strictly on the provided CONTEXT. 
        Do not make up information not present in the context.
        If the instruction is to "rewrite", rewrite the selected text using the context.
        If the instruction is to "give an example", provide a concrete example derived from the context.
        Return ONLY the refined text or explanation.
        """
        
        # 3. Generate Response
        try:
            response = self.llm.invoke(prompt)
            return {"refined_content": response.content}
        except Exception as e:
            return {"error": str(e)}

    # --- Folder Management ---
    def create_folder(self, user_id, name):
        conn = get_db_connection()
        if not conn:
            return None
        
        try:
            cur = conn.cursor()
            folder_id = str(uuid.uuid4())
            cur.execute(
                "INSERT INTO folders (id, user_id, name) VALUES (%s, %s, %s) RETURNING id",
                (folder_id, user_id, name)
            )
            conn.commit()
            cur.close()
            conn.close()
            return {"id": folder_id, "name": name}
        except Exception as e:
            print(f"Error creating folder: {e}")
            return None

    def get_all_folders(self, user_id):
        conn = get_db_connection()
        if not conn:
            return []
        
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor) # Ensure dicts are returned
            cur.execute("SELECT * FROM folders WHERE user_id = %s ORDER BY created_at DESC", (user_id,))
            folders = cur.fetchall()
            cur.close()
            conn.close()
            return folders
        except Exception as e:
            print(f"Error getting folders: {e}")
            return []

    def update_note_folder(self, note_id, folder_id):
        conn = get_db_connection()
        if not conn:
            return False
            
        try:
            cur = conn.cursor()
            cur.execute(
                "UPDATE notes SET folder_id = %s WHERE note_id = %s",
                (folder_id, note_id)
            )
            conn.commit()
            cur.close()
            conn.close()
            return True
        except Exception as e:
            print(f"Error updating note folder: {e}")
            return False

    def get_all_notes(self, user_id, folder_id=None):
        conn = get_db_connection()
        if not conn:
            print("DB Connection failed in get_all_notes")
            return []
        
        try:
            print(f"Fetching notes for user: {user_id}, folder: {folder_id}")
            cur = conn.cursor(cursor_factory=RealDictCursor)
            
            query = """
                SELECT note_id, title, created_date, note_type, is_in_folder, folder_id 
                FROM notes 
                WHERE user_id = %s
            """
            params = [user_id]
            
            if folder_id:
                query += " AND folder_id = %s"
                params.append(folder_id)
                
            query += " ORDER BY updated_date DESC"
            
            cur.execute(query, tuple(params))
            notes = cur.fetchall()
            cur.close()
            conn.close()
            print(f"Found {len(notes)} notes")
            return notes
        except Exception as e:
            print(f"Error getting notes: {e}")
            if conn:
                conn.close()
            return []

ai_service = AIService()
