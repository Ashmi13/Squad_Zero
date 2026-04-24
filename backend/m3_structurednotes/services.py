import os
import base64
import json
from io import BytesIO
# Make specific dependencies optional
# They will be imported inside functions so other team members
# don't need to install them if they don't do AI logic.
from dotenv import load_dotenv
from .database import get_db_connection
from psycopg2.extras import RealDictCursor
import uuid
import math
import re
from collections import Counter
import json
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
            # OpenRouter does not provide free robust text-embedding models reliably.
            # We revert to local HuggingFace to keep document processing functional and free.
            from langchain_huggingface import HuggingFaceEmbeddings
            print("Loading HuggingFace Embeddings for Document Vectorization...")
            self._embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        return self._embeddings

    @property
    def llm(self):
        if self._llm is None:
            from langchain_openai import ChatOpenAI
            
            # Use OpenRouter - dynamically read from environment
            api_key = os.getenv("OPENROUTER_API_KEY")
            model_name = os.getenv("OPENROUTER_MODEL", "liquid/lfm-2.5-1.2b-instruct:free")
            
            print(f"[*] Initializing AIService with model: {model_name}")
            
            self._llm = ChatOpenAI(
                api_key=api_key, 
                base_url="https://openrouter.ai/api/v1",
                model=model_name,
                temperature=0
            )
        return self._llm

    def extract_keywords_tfidf(self, text, top_n=10):
        """
        MANUAL ALGORITHM: Deep Topic Modeling via TF-IDF Scoring.
        We avoided using external libraries (like scikit-learn) to implement this completely manually.
        This algorithm calculates Term Frequency (TF) and Inverse Document Frequency (IDF) mathematically.
        By analyzing term rarity, it dives deeper than simple summarizing algorithms by pulling out core,
        sometimes hidden, thematic keywords (not just common words) from user content to build a highly structured note.
        """
        # Stopwords to ignore
        stopwords = {"the", "is", "in", "and", "to", "of", "a", "for", "on", "with", "as", "by", "this", 
                     "that", "it", "at", "from", "or", "an", "be", "are", "can", "will", "which"}
        
        # 1. Clean and tokenize text into words
        words = re.findall(r'\b[a-z]{3,}\b', text.lower())
        words = [w for w in words if w not in stopwords]
        
        if not words:
            return []
            
        # 2. Treat paragraphs/sentences as 'documents' for IDF calculation
        sentences = [s.strip() for s in text.lower().split('.') if len(s.strip()) > 10]
        if not sentences:
            sentences = [text.lower()]
            
        N = len(sentences)
        
        # 3. Calculate Term Frequency (TF) for the entire text
        word_counts = Counter(words)
        total_words = len(words)
        
        tfidf_scores = {}
        for word, count in word_counts.items():
            tf = count / total_words
            
            # 4. Calculate Inverse Document Frequency (IDF)
            # Count how many sentences contain the word
            doc_freq = sum(1 for sentence in sentences if word in sentence)
            idf = math.log(N / (1 + doc_freq)) + 1  # Add 1 to avoid zero weights
            
            # 5. Final TF-IDF Score
            tfidf_scores[word] = tf * idf
            
        # Sort words by score descending
        sorted_keywords = sorted(tfidf_scores.items(), key=lambda item: item[1], reverse=True)
        return [word for word, score in sorted_keywords[:top_n]]

    def extract_images_from_file(self, file_bytes, original_filename):
        print(f"[IMAGE DEBUG] Starting image extraction for: {original_filename}")
        results = []
        
        try:
            if original_filename.lower().endswith('.pdf'):
                print(f"[IMAGE DEBUG] Detected PDF file")
                try:
                    import fitz
                    print(f"[IMAGE DEBUG] PyMuPDF imported successfully")
                except ImportError:
                    print(f"[IMAGE DEBUG] ❌ PyMuPDF NOT installed! Run: pip install PyMuPDF")
                    return []
                
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                print(f"[IMAGE DEBUG] PDF opened. Total pages: {len(doc)}")
                
                for page_num, page in enumerate(doc):
                    image_list = page.get_images()
                    print(f"[IMAGE DEBUG] Page {page_num + 1}: found {len(image_list)} images")
                    
                    for img_index, img in enumerate(image_list):
                        try:
                            xref = img[0]
                            base_image = doc.extract_image(xref)
                            image_bytes = base_image["image"]
                            ext = base_image["ext"]
                            
                            import base64
                            image_b64 = base64.b64encode(image_bytes).decode()
                            media_type = f"image/{ext}"
                            
                            results.append({
                                "image_data": image_b64,
                                "media_type": media_type,
                                "page_or_slide": page_num + 1,
                                "caption": ""
                            })
                            print(f"[IMAGE DEBUG] OK: Extracted image {img_index + 1} from page {page_num + 1}, size: {len(image_bytes)} bytes")
                        except Exception as img_err:
                            print(f"[IMAGE DEBUG] ERR: Failed to extract image {img_index + 1} from page {page_num + 1}: {img_err}")
                
                doc.close()
                print(f"[IMAGE DEBUG] Total images extracted: {len(results)}")
                
                # Limit to 10
                results = results[:10]
                return results
                
            elif original_filename.lower().endswith('.pptx'):
                print(f"[IMAGE DEBUG] Detected PPTX file")
                try:
                    from pptx import Presentation
                    from io import BytesIO
                except ImportError:
                    print(f"[IMAGE DEBUG] ERR: python-pptx NOT installed!")
                    return []
                
                prs = Presentation(BytesIO(file_bytes))
                print(f"[IMAGE DEBUG] PPTX opened. Total slides: {len(prs.slides)}")
                
                for slide_num, slide in enumerate(prs.slides):
                    for shape in slide.shapes:
                        if shape.shape_type == 13:  # Picture
                            try:
                                import base64
                                image_bytes = shape.image.blob
                                content_type = shape.image.content_type
                                image_b64 = base64.b64encode(image_bytes).decode()
                                
                                results.append({
                                    "image_data": image_b64,
                                    "media_type": content_type,
                                    "page_or_slide": slide_num + 1,
                                    "caption": ""
                                })
                                print(f"[IMAGE DEBUG] OK: Extracted image from slide {slide_num + 1}")
                            except Exception as img_err:
                                print(f"[IMAGE DEBUG] ERR: Failed on slide {slide_num + 1}: {img_err}")
                
                print(f"[IMAGE DEBUG] Total images extracted: {len(results)}")
                results = results[:10]
                return results
            
            else:
                print(f"[IMAGE DEBUG] ERR: Unsupported file type: {original_filename}")
                return []
                
        except Exception as e:
            print(f"[IMAGE DEBUG] ERR: Complete failure in extract_images_from_file: {e}")
            import traceback
            traceback.print_exc()
            return []

    def process_pdf(self, file_bytes, pdf_id, original_filename):
        """
        Optimized document processor: 
        - Single pass for text and images (consolidated)
        - Uses fitz (PyMuPDF) for high-speed PDF parsing
        - Batch inserts chunks into Postgres for database efficiency
        """
        # Determine file type
        is_pptx = original_filename.lower().endswith('.pptx')
        extension = ".pptx" if is_pptx else ".pdf"

        # 1. Save File to disk for viewing (needed by frontend)
        save_dir = "documents"
        os.makedirs(save_dir, exist_ok=True)
        safe_filename = f"{pdf_id}{extension}"
        file_path = os.path.join(save_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        full_text = ""
        extracted_images = []

        try:
            # 2. Extract Text (Single Pass)
            if is_pptx:
                from pptx import Presentation
                prs = Presentation(BytesIO(file_bytes))
                for i, slide in enumerate(prs.slides):
                    for shape in slide.shapes:
                        if hasattr(shape, "text"):
                            full_text += shape.text + " "
                    full_text += "\n"
            elif original_filename.lower().endswith(('.md', '.txt')):
                full_text = file_bytes.decode('utf-8', errors='ignore')
            else:
                import fitz
                doc = fitz.open(stream=file_bytes, filetype="pdf")
                for i, page in enumerate(doc):
                    full_text += page.get_text() + "\n"
                doc.close()

            # 2b. Extract Images (Using debug method)
            print(f"[IMAGE DEBUG] Calling extract_images_from_file...")
            extracted_images = self.extract_images_from_file(file_bytes, original_filename)
            print(f"[IMAGE DEBUG] Got {len(extracted_images)} images back")

            # 3. Chunk text for Vector Storage
            from langchain_text_splitters import RecursiveCharacterTextSplitter
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1200, # Slightly larger chunks for better context
                chunk_overlap=200
            )
            chunks = text_splitter.split_text(full_text)
            if not chunks: chunks = ["No readable text found."]

            # 4. Generate Embeddings and Save to Postgres (Batch Mode)
            conn = get_db_connection()
            if conn:
                cur = conn.cursor()
                
                # Ensure table exists (Safety check)
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS document_images (
                        id TEXT PRIMARY KEY,
                        pdf_id TEXT,
                        image_data TEXT,
                        media_type TEXT,
                        page_number INTEGER,
                        caption TEXT
                    );
                """)
                
                # Batch insert images
                if extracted_images:
                    print(f"[IMAGE DEBUG] Attempting to save {len(extracted_images)} images to DB...")
                    for img in extracted_images:
                        img_id = str(uuid.uuid4())
                        cur.execute("""
                            INSERT INTO document_images (id, pdf_id, image_data, media_type, page_number, caption)
                            VALUES (%s, %s, %s, %s, %s, %s)
                        """, (img_id, pdf_id, img["image_data"], img["media_type"], img["page_or_slide"], img["caption"]))
                    print(f"[IMAGE DEBUG] Images saved to DB successfully")
                
                # Generate embeddings in one batch (Fastest way)
                print(f"[*] Vectorizing {len(chunks)} chunks for {pdf_id}...")
                embeddings = self.embeddings.embed_documents(chunks)
                
                # BATCH INSERT chunks using execute_values for maximum speed
                from psycopg2.extras import execute_values
                data_list = []
                for i, (chunk_text, embedding) in enumerate(zip(chunks, embeddings)):
                    chunk_id = str(uuid.uuid4())
                    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
                    data_list.append((
                        chunk_id, pdf_id, i, chunk_text, 
                        embedding_str, json.dumps({"source": original_filename})
                    ))
                
                execute_values(cur, """
                    INSERT INTO document_chunks (id, pdf_id, chunk_index, content, embedding, metadata)
                    VALUES %s
                """, data_list)
                
                conn.commit()
                cur.close()
                conn.close()
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Processing error for {original_filename}: {e}")
            if 'conn' in locals() and conn: conn.close()
        
        return {
            "status": "success",
            "pdf_url": f"/documents/{safe_filename}",
            "extracted_text": full_text[:1000], # Don't send whole text back to UI
            "image_count": len(extracted_images)
        }

    def get_images_for_pdf(self, pdf_id):
        print(f"[IMAGE DEBUG] Fetching images for pdf_id: {pdf_id}")
        conn = get_db_connection()
        if not conn:
            return []
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute("""
                SELECT image_data, media_type, page_number, caption
                FROM document_images
                WHERE pdf_id = %s
                ORDER BY page_number ASC
            """, (pdf_id,))
            results = cur.fetchall()
            cur.close()
            conn.close()
            print(f"[IMAGE DEBUG] Fetched {len(results)} images from DB")
            return results
        except Exception as e:
            print(f"Error fetching images for PDF: {e}")
            if conn: conn.close()
            return []

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
                INSERT INTO notes (note_id, user_id, title, content, created_at, updated_at, note_type, is_in_folder, has_embeddings)
                VALUES (%s, %s, %s, %s, NOW(), NOW(), 'ai_generated', FALSE, TRUE)
                RETURNING note_id
            """, (note_id, user_id, title, content))
            
            returned_id = cur.fetchone()[0]
            
            conn.commit()
            cur.close()
            conn.close()
            print(f"Note saved to DB via RETURNING: {returned_id}")
            return returned_id
        except Exception as e:
            print(f"Error saving to DB: {e}")
            if conn:
                conn.rollback()
            return None

    def extract_clean_points(self, text):
        points = []
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if not line or line.isdigit() or len(line) < 20:
                continue
            
            if line.isupper() and len(line) < 60:
                points.append({"type": "heading", "text": line})
            elif line.startswith(('-', '•', '*', '→', '>')):
                points.append({"type": "bullet", "text": line.lstrip('-•*→> ').strip()})
            elif re.match(r'^\d+[\.\)\:]', line):
                points.append({"type": "numbered", "text": line[2:].strip()})
            elif len(line) > 30:
                points.append({"type": "sentence", "text": line})
        return points

    def remove_duplicates(self, points):
        unique_points = []
        for i, p in enumerate(points):
            p_words = set(p['text'].lower().split())
            is_duplicate = False
            for up in unique_points:
                up_words = set(up['text'].lower().split())
                intersection = len(p_words.intersection(up_words))
                union = len(p_words.union(up_words))
                similarity = intersection / union if union > 0 else 0
                if similarity > 0.7:
                    is_duplicate = True
                    if len(p['text']) > len(up['text']):
                        up['text'] = p['text']
                    break
            if not is_duplicate:
                unique_points.append(p)
        return unique_points

    def score_point_importance(self, point_text, keywords, all_texts):
        score = 0
        match_count = sum(1 for k in keywords if k.lower() in point_text.lower())
        score += min(match_count * 8, 40)
        
        words = point_text.split()
        if 8 <= len(words) <= 25:
            score += 20
        elif 5 <= len(words) <= 40:
            score += 10
            
        markers = [" is ", " are ", " means ", " refers to ", " defined as ", " known as ", ":", "="]
        if any(m in point_text.lower() for m in markers):
            score += 20
            
        if any(char.isdigit() for char in point_text):
            score += 10
            
        prefix = " ".join(point_text.split()[:3]).lower()
        for other in all_texts:
            if other != point_text and other.lower().startswith(prefix):
                score -= 15
                break
                
        return max(score, 0)

    def group_points_by_topic(self, points, keywords):
        buckets = {}
        for i in range(0, len(keywords), 3):
            group = keywords[i:i+3]
            topic_name = " & ".join(group).title()
            buckets[topic_name] = []
            
        buckets["General Notes"] = []
        for p in points:
            best_bucket = "General Notes"
            max_matches = 0
            for topic in buckets:
                if topic == "General Notes": continue
                matches = sum(1 for word in topic.lower().split(" & ") if word in p['text'].lower())
                if matches > max_matches:
                    max_matches = matches
                    best_bucket = topic
            buckets[best_bucket].append(p)
        return {k: v for k, v in buckets.items() if v}


        
    def generate_note(self, pdf_ids: list, user_id: str,
                      instruction: str = "",
                      language: str = "English",
                      ordering: str = "ai"):
        """
        ULTIMATE STRUCTURED NOTE GENERATOR (Sequential Chapter Synthesis)
        1. Retrieval: Fetch all chunks for all selected materials.
        2. Pre-processing: Clean, deduplicate, and score every point (Manual Alg).
        3. Topic Modeling: Group points into logical chapters using TF-IDF (Manual Alg).
        4. Sequential Synthesis: Process each chapter individually via AI to ensure 
           COMPLETELY every point is well discussed without context loss.
        5. Assembly: Combine chapters into one continuous, high-fidelity note.
        """

        # PHASE 1 - Retrieval
        combined_text = ""
        conn = get_db_connection()
        if not conn: return "Error: DB Connection failed."
        try:
            for pdf_id in pdf_ids:
                cur = conn.cursor()
                cur.execute("""
                    SELECT content FROM document_chunks 
                    WHERE pdf_id = %s ORDER BY chunk_index ASC
                """, (pdf_id,))
                rows = cur.fetchall()
                combined_text += f"\n\n--- DOC: {pdf_id} ---\n" + "\n".join([r[0] for r in rows])
                cur.close()
            conn.close()
        except Exception as e:
            if conn: conn.close()
            return f"Retrieval Error: {e}"

        if not combined_text.strip(): return "No material found."

        # PHASE 2 - Manual Pre-processing (Cleaning, Keywords, Scoring)
        all_points = self.extract_clean_points(combined_text)
        unique_points = self.remove_duplicates(all_points)
        keywords = self.extract_keywords_tfidf(combined_text, top_n=20)
        point_texts = [p['text'] for p in unique_points]
        for p in unique_points:
            p['score'] = self.score_point_importance(p['text'], keywords, point_texts)

        # PHASE 3 - Chapter Grouping (TF-IDF buckets)
        topic_groups = self.group_points_by_topic(unique_points, keywords)
        
        # NEW PHASE 8 — Chunked Generation
        section_notes = []
        all_images = [] 
        for pdf_id in pdf_ids:
            all_images.extend(self.get_images_for_pdf(pdf_id))
        print(f"[IMAGE DEBUG] Total images collected for note: {len(all_images)}")
        
        # Track hinted images
        used_image_indices = set()

        for i, (topic_name, points) in enumerate(topic_groups.items()):
            # Sort points by score for this section
            sorted_points = sorted(points, key=lambda x: x['score'], reverse=True)
            
            section_content = ""
            for p in sorted_points:
                label = "HIGH" if p['score'] >= 50 else "MEDIUM" if p['score'] >= 25 else "LOW"
                section_content += f"[{label}] {p['text']}\n"
            
            # Limit section content to 3000 chars for deeper discussion
            section_content = section_content[:3000]

            # Detect relevant images for this section
            section_images_hint = []
            for idx, img in enumerate(all_images[:20]):
                if idx not in used_image_indices:
                    # Distribute images: ~1.5 images per section
                    if (i * 1.5) <= idx < ((i + 1) * 1.5):
                        section_images_hint.append(f"[IMAGE_{idx+1}: page {img['page_number']}]")
                        used_image_indices.add(idx)

            image_hints_str = ", ".join(section_images_hint) if section_images_hint else "None available."

            section_prompt = f"""
You are NotesGPT — a world-class academic writer.
Write a DEEP and high-fidelity section of a study note in {language}.

TOPIC: {topic_name}

SOURCE CONTENT:
{section_content}

IMAGE LOCATIONS: {image_hints_str}

STRICT OUTPUT FORMAT:
- Start with the ## 📌 {topic_name} heading immediately.
- Use ONLY highly detailed bullet points (NO generic summaries).
- Each bullet point MUST be 2 to 4 lines long, providing deep context.
- Bold all key terms. Use ⚡ for HIGH importance points.
- Include EVERY single detail from the source content; do not summarize or skip.
- Connect concepts into a professional, continuous academic flow.
- Place image hints on their own line between bullets if provided.
- End with End_of_Notes.
"""
            try:
                print(f"[*] Generating section: {topic_name}")
                response = self.llm.invoke(section_prompt)
                res_text = response.content.strip()
                # Strip End_of_Notes
                res_text = res_text.replace("End_of_Notes", "").strip()
                # Clean up markdown fences
                res_text = re.sub(r'^```markdown\n|^```\n|```$', '', res_text, flags=re.MULTILINE)
                res_text = self.clean_note_formatting(res_text)
                section_notes.append(res_text)
            except Exception as e:
                print(f"Error generating section {topic_name}: {e}")
                fallback = f"## 📌 {topic_name}\n"
                for p in sorted_points[:5]:
                    fallback += f"- **{p['text'][:50]}**: {p['text']}\n"
                section_notes.append(fallback)

        # NEW PHASE 9 — Build title
        title_line = f"# 🎯 {keywords[0].title()} Study Notes" # Default
        try:
            kw_str = ", ".join(keywords[:5])
            title_prompt = f"Generate ONLY a single title line in the format: # 🎯 [Title]. Base it on these keywords: {kw_str}. Write in {language}."
            title_res = self.llm.invoke(title_prompt)
            title_line = title_res.content.strip().split('\n')[0]
        except Exception:
            pass

        # NEW PHASE 10 — Build takeaways
        takeaway_text = "## 🗝️ Key Takeaways\n- Critical concepts discussed in material."
        try:
            # Merge some content for takeaways
            merged_for_takeaways = "\n".join(section_notes)[:2000]
            takeaways_prompt = f"""
Based on the following content, generate ONLY the ## 🗝️ Key Takeaways section in {language}.
Rules:
- 6-8 bullets, each a complete meaningful sentence.
- Start with ## 🗝️ immediately.
- End with End_of_Notes.

CONTENT:
{merged_for_takeaways}
"""
            takeaways_res = self.llm.invoke(takeaways_prompt)
            takeaway_text = takeaways_res.content.strip().replace("End_of_Notes", "").strip()
        except Exception:
            pass

        # NEW PHASE 11 — Assemble final note
        final_note = title_line + "\n\n" + "\n---\n".join(section_notes) + "\n\n" + takeaway_text
        final_note = self.clean_note_formatting(final_note)

        # Image Injection (Final Post-processing)
        for i, img in enumerate(all_images[:20]):
            placeholder = f"[IMAGE_{i+1}: page {img['page_number']}]"
            html_block = f"""
<div style="text-align:center; margin: 20px 0;">
  <img src="data:{img['media_type']};base64,{img['image_data']}"
       style="max-width:100%; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
       alt="Contextual Figure" />
  <p style="font-size:12px; color:#666; margin-top:8px;">Source: Page/Slide {img['page_number']}</p>
</div>"""
            final_note = final_note.replace(placeholder, html_block)

        return final_note

    def clean_note_formatting(self, text):
        """
        Manual algorithm: Cleans and fixes note formatting.
        Ensures every bullet point is on its own line.
        Fixes AI responses that merge bullets into one line.
        """
        import re
        
        # Step 1: Replace ' - **' pattern with newline + '- **'
        # This fixes merged bullets like "text - **Next"
        text = re.sub(r'\s+-\s+\*\*', '\n- **', text)
        
        # Step 2: Replace ' - ' that appears mid-sentence
        # Only when followed by capital or **
        text = re.sub(r'(?<=[a-z.!?])\s+-\s+(?=[A-Z\*])', '\n- ', text)
        
        # Step 3: Ensure ## headings always on own line
        text = re.sub(r'([^\n])##', r'\1\n\n##', text)
        
        # Step 4: Ensure ### headings always on own line
        text = re.sub(r'([^\n])###', r'\1\n\n###', text)
        
        # Step 5: Ensure > blockquotes on own line
        text = re.sub(r'([^\n])>', r'\1\n>', text)
        
        # Step 6: Remove more than 3 consecutive newlines
        text = re.sub(r'\n{4,}', '\n\n\n', text)
        
        # Step 7: Ensure --- dividers on own line
        text = re.sub(r'([^\n])---', r'\1\n\n---', text)
        text = re.sub(r'---([^\n])', r'---\n\n\1', text)
        
        # Step 8: Fix ⚡ bullets merged in line
        text = re.sub(r'(?<=[a-z.!?])\s+- ⚡', '\n- ⚡', text)
        text = re.sub(r'(?<=[a-z.!?])\s+- ⚠️', '\n- ⚠️', text)
        text = re.sub(r'(?<=[a-z.!?])\s+- 💡', '\n- 💡', text)
        
        # Step 9: Ensure blank line before every ## heading
        text = re.sub(r'\n(##)', r'\n\n\1', text)
        
        # Step 10: Ensure blank line after every ## heading
        text = re.sub(r'(## .+)\n([^\n])', r'\1\n\n\2', text)
        
        return text.strip()

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
                "UPDATE notes SET content = %s, updated_at = NOW() WHERE note_id = %s",
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

    def refine_text(self, pdf_id: str, selected_text: str,
                    instruction: str):
        """
        HYBRID: Manual algorithm finds relevant context,
        AI answers in structured note format.
        """

        # ── MANUAL ALGORITHM: Relevance Scorer ──
        # Score each document chunk by relevance to the
        # selected text + instruction using keyword overlap.
        # This is a manual TF-IDF-based relevance algorithm.

        def score_relevance(chunk_text, query_words):
            """
            Manual relevance scoring algorithm.
            Counts how many query words appear in chunk.
            Weights by position — earlier chunks score higher
            to prefer introductory/definitional content.
            Returns a relevance score integer.
            """
            chunk_lower = chunk_text.lower()
            score = 0
            for word in query_words:
                if len(word) < 3:
                    continue
                count = chunk_lower.count(word)
                score += count * 2
            # Bonus for exact phrase match
            if selected_text.lower()[:30] in chunk_lower:
                score += 20
            return score

        # Extract query words from selected text
        # and instruction combined
        import re
        stopwords = {
            "the","is","in","and","to","of","a","for",
            "on","with","as","by","this","that","it",
            "at","from","or","an","be","are","can",
            "will","which","what","how","why","more",
            "give","make","explain","me","please","yet",
            "not","clear","this","part","want","need"
        }
        combined_query = selected_text + " " + instruction
        query_words = [
            w.lower() for w in
            re.findall(r'\b[a-z]{3,}\b', combined_query.lower())
            if w.lower() not in stopwords
        ]

        # Fetch all chunks for this PDF from database
        context_chunks = []
        conn = get_db_connection()
        if conn:
            try:
                cur = conn.cursor()
                cur.execute("""
                    SELECT content, chunk_index
                    FROM document_chunks
                    WHERE pdf_id = %s
                    ORDER BY chunk_index ASC
                """, (pdf_id,))
                rows = cur.fetchall()
                cur.close()
                conn.close()

                # Score each chunk manually
                scored_chunks = []
                for row in rows:
                    chunk_text = row[0]
                    score = score_relevance(chunk_text, query_words)
                    scored_chunks.append((score, chunk_text))

                # Sort by relevance score descending
                scored_chunks.sort(reverse=True)

                # Take top 4 most relevant chunks
                context_chunks = [
                    chunk for score, chunk in scored_chunks[:4]
                    if score > 0
                ]

                # Fallback: if no relevant chunks found
                # use vector similarity search
                if not context_chunks:
                    try:
                        query_embedding = self.embeddings.embed_query(
                            combined_query
                        )
                        conn2 = get_db_connection()
                        if conn2:
                            cur2 = conn2.cursor()
                            cur2.execute("""
                                SELECT content
                                FROM document_chunks
                                WHERE pdf_id = %s
                                ORDER BY embedding <=> %s::vector
                                LIMIT 4
                            """, (pdf_id, "[" + ",".join(str(x) for x in query_embedding) + "]"))
                            context_chunks = [
                                r[0] for r in cur2.fetchall()
                            ]
                            cur2.close()
                            conn2.close()
                    except Exception as e:
                        print(f"Vector fallback failed: {e}")

            except Exception as e:
                print(f"Error fetching chunks: {e}")
                if conn:
                    conn.close()

        context_text = "\n\n".join(context_chunks)

        # ── DETECT INSTRUCTION TYPE ──
        # Manual classification of what user wants
        instruction_lower = instruction.lower()

        if any(word in instruction_lower for word in
               ["example", "eg", "instance", "show me"]):
            task_type = "GIVE_EXAMPLE"
            task_instruction = """
                Provide 2-3 concrete real-world examples that
                clearly illustrate the selected concept.
                Each example must be specific and easy to
                visualize. After examples briefly explain
                why each one demonstrates the concept.
            """
        elif any(word in instruction_lower for word in
                 ["not clear", "confused", "understand",
                  "what does", "what is", "explain", "elaborate"]):
            task_type = "DEEP_EXPLAIN"
            task_instruction = """
                Give a thorough step-by-step explanation of
                the selected concept. Start from the basics,
                explain the why and how, use an analogy if
                helpful, then connect back to the main topic.
            """
        elif any(word in instruction_lower for word in
                 ["organize", "structured", "clean",
                  "format", "arrange", "easy to focus"]):
            task_type = "REORGANIZE"
            task_instruction = """
                Reorganize and restructure the selected content
                into a cleaner, more logical and scannable
                format. Break it into clear sub-points.
                Keep all information but make it easier to
                read and absorb at a glance.
            """
        elif any(word in instruction_lower for word in
                 ["shorter", "simpler", "simplify",
                  "brief", "concise", "summarize"]):
            task_type = "SIMPLIFY"
            task_instruction = """
                Rewrite the selected content in simpler,
                shorter language. Use plain words a student
                can understand instantly. Keep all key facts
                but remove complexity and unnecessary words.
            """
        else:
            task_type = "GENERAL"
            task_instruction = f"""
                The user asked: {instruction}
                Answer this specific request about the
                selected text using the provided context.
                Be thorough and helpful.
            """

        # ── BUILD PROMPT ──
        prompt = f"""
You are NotesGPT — expert academic note writer.
A student is working with their structured study note
and needs help with a specific selected part.

CONTEXT FROM ORIGINAL DOCUMENT:
{context_text if context_text else "No additional context available."}

THE STUDENT SELECTED THIS TEXT FROM THEIR NOTE:
\"\"\"{selected_text}\"\"\"

STUDENT'S REQUEST: {instruction}

TASK TYPE DETECTED: {task_type}
{task_instruction}

OUTPUT FORMAT RULES — FOLLOW EXACTLY:
Your response must be in the EXACT SAME FORMAT
as the structured note the student is reading.
Use this format:

## 📌 [Topic Title Describing Selected Content]

> [One line intro explaining what this response covers]

- ⚡ **[Key Term or Point]**: Full explanation here.
  Additional context or detail on second line.
  Third line if needed for examples or connection.

- **[Another Point]**: Explanation with enough detail
  that a student fully understands without other help.

- 💡 **[Insight or Example]**: Concrete real-world
  example or interesting insight that helps it click.

- ⚠️ **[If confusion point exists]**: Clarify the
  common mistake or misunderstanding about this topic.

## 🗝️ Key Takeaways from This Section
- ⚡ **[Most important point]**: Full sentence.
- **[Second point]**: Full sentence.
- **[Third point]**: Full sentence.

STRICT RULES:
1. Never write paragraphs — only bullets with explanations
2. Every bullet minimum 2 lines, maximum 4 lines
3. Bold all key terms
4. Start IMMEDIATELY with ## 📌 heading
5. Do not write "Here is" or any meta phrases
6. Write in English
7. End with End_of_Notes on its own line
"""

        try:
            response = self.llm.invoke(prompt)
            result = response.content.strip()
            # Remove End_of_Notes marker before returning
            result = result.replace("End_of_Notes", "").strip()
            if result.startswith("```"):
                result = re.sub(r"^```markdown\n|^```\n|```$", "", result, flags=re.MULTILINE)
            return {"refined_content": result}
        except Exception as e:
            return {
                "refined_content": f"""## 📌 Response

> Could not process with AI. Showing context found.

{chr(10).join(f'- {c[:200]}' for c in context_chunks[:3])}
""",
                "error": str(e)
            }

    def discuss_note(self, note_content: str,
                     user_question: str,
                     pdf_id: str = None):
        """
        HYBRID: Manual algorithm extracts relevant sections
        from note, AI answers in structured note format.
        Feature 2 — whole note discussion mode.
        """

        # ── MANUAL ALGORITHM: Note Section Extractor ──
        # Finds which sections of the note are most relevant
        # to the user question using keyword scoring.
        # This is a manual algorithm — no AI used here.

        def extract_relevant_sections(note_html, query):
            """
            Manual algorithm: splits note by ## headings,
            scores each section by keyword overlap with query,
            returns top 3 most relevant sections as text.
            """
            import re

            # Remove HTML tags to get plain text
            plain = re.sub(r'<[^>]+>', '', note_html)

            # Split by section headings
            sections = re.split(r'\n##\s+', plain)

            # Get query keywords
            stopwords = {
                "the","is","in","and","to","of","a",
                "for","on","with","as","by","this","that",
                "it","at","from","or","an","be","are",
                "can","will","which","what","how","why",
                "more","want","need","me","my","make",
                "please","about","tell","explain"
            }
            query_words = [
                w.lower() for w in
                re.findall(r'\b[a-z]{3,}\b', query.lower())
                if w.lower() not in stopwords
            ]

            # Score each section
            scored = []
            for section in sections:
                if len(section.strip()) < 30:
                    continue
                section_lower = section.lower()
                score = sum(
                    section_lower.count(word) * 2
                    for word in query_words
                )
                scored.append((score, section.strip()))

            # Sort by score and return top 3
            scored.sort(reverse=True)
            top_sections = [s for sc, s in scored[:3] if sc > 0]

            # Fallback: return first 1000 chars of note
            if not top_sections:
                return [plain[:1000]]

            return top_sections

        # Run manual section extractor
        relevant_sections = extract_relevant_sections(
            note_content, user_question
        )
        relevant_text = "\n\n---\n\n".join(relevant_sections)

        # Limit to 3000 chars
        relevant_text = relevant_text[:3000]

        # ── BUILD PROMPT ──
        prompt = f"""
You are NotesGPT — expert academic note writer.
A student has a structured study note and wants
to explore or improve part of it through a question.

RELEVANT SECTIONS FROM THEIR NOTE:
{relevant_text}

STUDENT'S QUESTION OR REQUEST:
{user_question}

YOUR TASK:
Answer the student's question OR fulfill their request
using ONLY the content from their note sections above.
If they want reorganization, reorganize only that content.
If they want more detail, expand using the context given.
If they want a different format, reformat it.

OUTPUT FORMAT — SAME AS THEIR NOTE:

## 📌 [Topic That Answers Their Question]

> [One line saying what this response provides]

- ⚡ **[Key Point]**: Full explanation in 2-3 lines.
  Give enough detail that it fully answers the question.

- **[Another Point]**: Explanation with context.
  Connect it to the student's original question.

- 💡 **[Tip or Insight]**: Something helpful the
  student can use when studying this material.

## 🗝️ Key Takeaways
- ⚡ **[Point 1]**: Complete meaningful sentence.
- **[Second point]**: Complete meaningful sentence.
- **[Third point]**: Complete meaningful sentence.

STRICT RULES:
1. Bullets only — no paragraphs
2. Every bullet 2 to 4 lines
3. Bold all key terms
4. Start with ## 📌 immediately
5. No meta phrases ever
6. End with End_of_Notes
"""

        try:
            response = self.llm.invoke(prompt)
            result = response.content.strip()
            result = result.replace("End_of_Notes", "").strip()
            if result.startswith("```"):
                result = re.sub(r"^```markdown\n|^```\n|```$", "", result, flags=re.MULTILINE)
            return {"refined_content": result}
        except Exception as e:
            return {
                "refined_content": f"""## 📌 Response

> Showing relevant sections from your note.

{chr(10).join(f'- {line.strip()}' for line in relevant_text.split(chr(10)) if len(line.strip()) > 20)[:800]}
""",
                "error": str(e)
            }

    def summarize_prompts(self, prompts: list,
                          original_text: str = None) -> str:
        """
        Generate topic label describing WHAT the text
        is about — not what was done to it.
        Uses manual keyword extraction before calling AI.
        """
        if not prompts:
            return "Refined Section"

        # ── MANUAL ALGORITHM: Extract subject keywords ──
        # Find the most meaningful words from original text
        # to identify the actual topic being discussed.
        import re
        stopwords = {
            "the","is","in","and","to","of","a","for",
            "on","with","as","by","this","that","it",
            "at","from","or","an","be","are","can",
            "will","which","make","give","explain",
            "more","please","want","need","clear","yet"
        }

        subject_keywords = []
        if original_text:
            words = re.findall(
                r'\b[a-zA-Z]{4,}\b', original_text
            )
            word_counts = {}
            for w in words:
                wl = w.lower()
                if wl not in stopwords:
                    word_counts[wl] = word_counts.get(wl,0)+1
            # Top 3 most frequent meaningful words
            sorted_words = sorted(
                word_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )
            subject_keywords = [w for w,c in sorted_words[:3]]

        keywords_hint = ", ".join(subject_keywords)
        prompt_history = " → ".join(prompts)
        text_snippet = ""
        if original_text:
            text_snippet = original_text[:120].replace('\n',' ')

        prompt = f"""
You are a precise topic labeler for academic notes.

SELECTED TEXT SUBJECT (from keyword analysis):
{keywords_hint}

TEXT SNIPPET: {text_snippet}

USER INSTRUCTION SEQUENCE: {prompt_history}

YOUR JOB:
Generate a SHORT topic label (maximum 5 words) that
describes WHAT THE SELECTED TEXT IS ABOUT.
The label should work as a section heading in a note.

GOOD LABEL EXAMPLES:
  Mitochondria Energy Production
  Market Segmentation Strategies
  Newton Laws of Motion
  SQL Database Normalization
  Photosynthesis Light Reactions

BAD LABEL EXAMPLES:
  Refined Text
  AI Adjustment
  Simplified Version
  User Edit
  Modified Content

Output ONLY the topic label.
No quotes. No punctuation at end.
Capitalize each word. Nothing else.
"""

        try:
            response = self.llm.invoke(prompt)
            return response.content.strip().strip('"').strip("'")
        except Exception:
            # Manual fallback using extracted keywords
            if subject_keywords:
                return " ".join(
                    w.capitalize() for w in subject_keywords[:3]
                )
            return "Refined Study Content"

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
                "UPDATE notes SET folder_id = %s, updated_at = NOW() WHERE note_id = %s",
                (folder_id, note_id)
            )
            # Check if the note actually existed and was updated
            success = cur.rowcount > 0 
            
            conn.commit()
            cur.close()
            conn.close()
            return success
        except Exception as e:
            # Fixed the string formatting here (added the 'f' before the quotes)
            print(f"Error updating note folder: {e}") 
            if conn:
                conn.close()
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
                SELECT note_id, title, created_at, note_type, is_in_folder, folder_id 
                FROM notes 
                WHERE user_id = %s
            """
            params = [user_id]
            
            if folder_id:
                query += " AND folder_id = %s"
                params.append(folder_id)
                
            query += " ORDER BY updated_at DESC"
            
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
