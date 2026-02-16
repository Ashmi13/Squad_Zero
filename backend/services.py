import os
from PyPDF2 import PdfReader
from io import BytesIO
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_classic.chains import RetrievalQA
from dotenv import load_dotenv
from database import get_db_connection
from psycopg2.extras import RealDictCursor
import uuid

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

    def process_pdf(self, file_bytes, pdf_id):
        # Extract text using the guide's manual algorithm
        reader = PdfReader(BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        
        # Split text into chunks for the Vector DB (Use Recursive for safer splits)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
        split_docs = text_splitter.split_text(text)
        
        docs = []
        for i, doc_text in enumerate(split_docs):
            docs.append(
                text_splitter.create_documents(
                    texts=[doc_text], 
                    metadatas=[{"pdf_id": pdf_id, "chunk_index": i}]
                )[0]
            )
        
        # Store in local Vector DB (ChromaDB)
        vectorstore = Chroma.from_documents(
            documents=docs, 
            embedding=self.embeddings,
            persist_directory="./chroma_db"
        )
        return "PDF Processed Successfully"

    def save_note_to_db(self, user_id, pdf_id, title, content):
        conn = get_db_connection()
        if not conn:
            return "Database connection failed"
        
        try:
            cur = conn.cursor()
            note_id = str(uuid.uuid4())
            
            # Insert into notes table
            cur.execute("""
                INSERT INTO notes (note_id, user_id, title, content, created_date, updated_date, note_type, is_in_folder, has_embeddings)
                VALUES (%s, %s, %s, %s, NOW(), NOW(), 'ai_generated', FALSE, FALSE)
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
        # Retrieve ALL chunks for this PDF, sorted by index
        vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=self.embeddings)
        
        # Get all documents for this PDF ID
        results = vectorstore.get(where={"pdf_id": pdf_id}, include=["metadatas", "documents"])
        
        if not results['documents']:
            return "No content found for this PDF."

        # Combine metadata and documents into a list of tuples
        combined = list(zip(results['metadatas'], results['documents']))
        
        # Sort by chunk_index to maintain document order
        # We use a default of 0 if chunk_index is missing (for older uploads)
        combined.sort(key=lambda x: x[0].get('chunk_index', 0))
        
        sorted_docs = [doc for _, doc in combined]
        
        # Batch processing configuration
        BATCH_SIZE = 3  # Reduced to 3 to be extremely safe with Groq limits
        
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
            conn.commit()
            cur.close()
            conn.close()
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

ai_service = AIService()
