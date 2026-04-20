from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
print(f"DEBUG: API Key loaded: {api_key[:10] if api_key else 'NOT FOUND'}...")

client = OpenAI(api_key=api_key)

def generate_summary(text: str, style: str = "default") -> str:
    """
    Generate a summary of text using OpenAI.
    
    Args:
        text: The text to summarize
        style: 'default', 'bullet', or 'short'
        
    Returns:
        Generated summary as string
    """
    
    style_prompts = {
        "default": "Provide a clear, comprehensive summary in 3-4 paragraphs.",
        "bullet": "Provide a summary as bullet points. Each point should be concise.",
        "short": "Provide a very short summary in 2-3 sentences."
    }
    
    style_instruction = style_prompts.get(style, style_prompts["default"])
    
    try:
        print(f"DEBUG: Calling OpenAI with text length: {len(text)}")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a study assistant. Summarize content clearly and accurately."
                },
                {
                    "role": "user",
                    "content": f"{style_instruction}\n\nText to summarize:\n\n{text}"
                }
            ],
            max_tokens=500,
            temperature=0.7
        )
        
        print(f"DEBUG: Summary generated successfully")
        return response.choices[0].message.content
    
    except Exception as e:
        print(f"DEBUG: OpenAI Error: {type(e).__name__}: {str(e)}")
        raise ValueError(f"Error generating summary: {str(e)}")


def answer_question(question: str, context: str, highlighted_text: str = None) -> str:
    """
    Answer a question based on document context.
    
    Args:
        question: The user's question
        context: The document context (summary or full text)
        highlighted_text: Optional highlighted text for context
        
    Returns:
        Answer as string
    """
    
    prompt = f"""You are a helpful study assistant. Answer the user's question clearly and concisely based on the provided context.

Context from document:
{context}

{"Highlighted text the user is asking about: " + highlighted_text if highlighted_text else ""}

User's question: {question}

Provide a clear, educational answer."""
    
    try:
        print(f"DEBUG: Calling OpenAI for Q&A")
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a knowledgeable study assistant. Answer questions clearly and help students understand concepts."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=400,
            temperature=0.7
        )
        
        print(f"DEBUG: Answer generated successfully")
        return response.choices[0].message.content
    
    except Exception as e:
        print(f"DEBUG: OpenAI Error: {type(e).__name__}: {str(e)}")
        raise ValueError(f"Error answering question: {str(e)}")