import os
import json
from PyPDF2 import PdfReader
from io import BytesIO
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv
from database import get_db_connection
from psycopg2.extras import RealDictCursor
import uuid
import numpy as np

load_dotenv()

class AIService:

    def __init__(self):
        # Use HuggingFace local embeddings (free)
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        # Use Groq for LLM (free tier)
        api_key = os.getenv("GROQ_API_KEY")
        self.llm = ChatGroq(
            groq_api_key=api_key, 
            model_name="llama-3.1-8b-instant",
            temperature=0
        )

    def process_pdf(self, file_bytes, pdf_id, original_filename):
        # 1. Save PDF to disk for viewing
        save_dir = "documents"
        os.makedirs(save_dir, exist_ok=True)
        
        safe_filename = f"{pdf_id}.pdf"
        file_path = os.path.join(save_dir, safe_filename)
        
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        # 2. Extract text
        reader = PdfReader(BytesIO(file_bytes))
        full_text = ""
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
            return "Database connection failed"
        
        try:
            cur = conn.cursor()
            note_id = str(uuid.uuid4())
            
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

    def refine_text(self, pdf_id, selected_text, instruction):
        # Similar logic, maybe we don't need vector search if selection is small, 
        # But if we want context *around* the selection, we could use it.
        # For now, just refine the selection using LLM.
        
        prompt = f"""
        Original Text: "{selected_text}"
        
        Instruction: {instruction}
        
        Refine the text above according to the instruction. Return ONLY the refined text.
        """
        
        try:
            response = self.llm.invoke(prompt)
            return {"refined_content": response.content}
        except Exception as e:
            return {"error": str(e)}
        # Split documents into batches
        batches = [sorted_docs[i:i + BATCH_SIZE] for i in range(0, len(sorted_docs), BATCH_SIZE)]
        
        final_notes = []
        
        from langchain_core.prompts import PromptTemplate
        from langchain_core.messages import HumanMessage, SystemMessage

        instruction_text = f"USER INSTRUCTION: {instruction}\n" if instruction else ""

        prompt_template = """You are an expert document summarizer. 
        Read the text below (Part {current_part} of {total_parts}) and generate a structured note.
        
        """ + instruction_text + """
        
        CRITICAL INSTRUCTIONS:
        1. Maintain the EXACT sequence of topics as they appear in the text.
        2. Do NOT merge distinct subtopics. Keep them separate.
        3. Use the following Markdown format:
        
        # [Main Document Title] (Only if this is Part 1)
        
        ## [Topic 1 from text]
        - **[Concept]**: [Detailed explanation]
        - **[Concept]**: [Detailed explanation]
        
        ## [Topic 2 from text]
        (and so on...)
        
        Text content:
        {text}
        
        Structured Note:"""

        print(f"Processing {len(batches)} batches...")

        for i, batch in enumerate(batches):
            print(f"Processing batch {i+1}/{len(batches)}")
            batch_text = "\n\n".join(batch)
            
            formatted_prompt = prompt_template.format(
                current_part=i+1, 
                total_parts=len(batches), 
                text=batch_text
            )
            
            messages = [
                SystemMessage(content="You are a helpful AI assistant that generates structured notes from documents."),
                HumanMessage(content=formatted_prompt)
            ]
            
            try:
                response = self.llm.invoke(messages)
                final_notes.append(response.content)
            except Exception as e:
                final_notes.append(f"\n\n[Error processing batch {i+1}: {str(e)}]\n\n")

        full_note = "\n\n".join(final_notes)
        
        # Save to PostgreSQL
        # Extract a simple title (first line or default)
        title = full_note.split('\n')[0].replace('#', '').strip()
        if not title:
            title = "Generated Note"
            
        note_id = self.save_note_to_db(user_id, pdf_id, title, full_note)
            
        return {"note_id": note_id, "content": full_note}

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
        search_query = f"{selected_text} {instruction}"
        vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=self.embeddings)
        
        # Filter by PDF ID to only search within the correct document
        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 3, "filter": {"pdf_id": pdf_id}}
        )
        
        context_docs = retriever.invoke(search_query)
        context_text = "\n\n".join([doc.page_content for doc in context_docs])
        
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
        """
        
        # 3. Generate Response
        response = self.llm.invoke(prompt)
        return response.content

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
