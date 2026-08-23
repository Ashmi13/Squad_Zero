import os
import sys
import asyncio
from dotenv import load_dotenv

# Load env variables
load_dotenv()
sys.path.append('.')

from services.mindmap_service import MindMapService
from app.db.supabase import get_supabase

# Generate a real, valid PDF using reportlab
def generate_valid_pdf(filename="scratch/real_test.pdf"):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    
    doc = SimpleDocTemplate(filename, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    title = "Introduction to Software Engineering and Architecture"
    story.append(Paragraph(title, styles['Title']))
    story.append(Spacer(1, 12))
    
    body_text_1 = (
        "Software engineering is a systematic, disciplined, and quantifiable approach to the development, "
        "operation, and maintenance of software. It applies engineering principles to create software systems "
        "that are reliable, efficient, secure, and maintainable. Major topics include software processes, "
        "requirements engineering, software design, testing, and system deployment."
    )
    story.append(Paragraph(body_text_1, styles['BodyText']))
    story.append(Spacer(1, 12))
    
    body_text_2 = (
        "Software architecture refers to the high-level structures of a software system. It consists of software "
        "elements, relations among them, and properties of both elements and relations. Common architectural patterns "
        "include Microservices, Layered (N-tier) architecture, Event-driven architecture, and Client-Server architecture. "
        "Selecting the right architecture is critical for scalability, performance, and future maintainability of the project."
    )
    story.append(Paragraph(body_text_2, styles['BodyText']))
    
    doc.build(story)
    print(f"[DEBUG] Generated valid PDF: {filename} ({os.path.getsize(filename)} bytes)")

class MockUploadFile:
    def __init__(self, filename, filepath):
        self.filename = filename
        self.filepath = filepath
        
    async def read(self):
        with open(self.filepath, "rb") as f:
            return f.read()

async def main():
    try:
        # Generate valid PDF
        generate_valid_pdf()
        
        supabase = get_supabase().service_client
        
        # Get a user ID from the database
        users_res = supabase.table("users").select("id").limit(1).execute()
        if not users_res.data:
            print("[ERROR] No users found in public.users")
            return
        user_id = users_res.data[0]["id"]
        
        file = MockUploadFile("real_test.pdf", "scratch/real_test.pdf")
        service = MindMapService(supabase)
        
        print("[DEBUG] Initiating generate_from_pdf...")
        result = await service.generate_from_pdf(
            file=file,
            user_id=user_id,
            title="Test Pipeline Mindmap",
            description="Testing AI + DB pipeline"
        )
        print(f"[SUCCESS] Pipeline executed successfully! Output: {result}")
        
        # Cleanup generated mindmap
        if "mindmap_id" in result:
            print(f"[DEBUG] Cleaning up generated mindmap {result['mindmap_id']}...")
            supabase.table("mindmaps").delete().eq("id", result["mindmap_id"]).execute()
            print("[SUCCESS] Cleanup finished")
            
    except Exception as e:
        import traceback
        print("\n[FAIL] Traceback of the error:")
        traceback.print_exc()
        
    finally:
        # Clean up real_test.pdf
        if os.path.exists("scratch/real_test.pdf"):
            try:
                os.remove("scratch/real_test.pdf")
            except Exception:
                pass

if __name__ == "__main__":
    asyncio.run(main())
