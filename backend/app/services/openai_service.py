"""
OpenAI Service - AI-Powered Text Processing

ROLE IN INTEGRATION:
This service is called by backend/routes/pdf.py when frontend requests summary generation.
It communicates with OpenAI API (gpt-3.5-turbo model) to generate intelligent summaries.

HOW IT WORKS:
1. Receives extracted text from frontend via routes/pdf.py
2. Constructs a prompt for OpenAI with the text to summarize
3. Sends prompt to OpenAI API (gpt-3.5-turbo model)
4. OpenAI analyzes text and generates summary
5. Returns summary to frontend

REQUIREMENTS:
- OpenAI Python package: pip install openai>=1.3.0
- OpenAI API Key: Must be set in .env file as OPENAI_API_KEY
- Active OpenAI account with API credit/billing

INTEGRATION POINTS:
- Called from: backend/routes/pdf.py generate_summary() endpoint
- Input: Extracted PDF text (string)
- Output: AI-generated summary (string)
"""

from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

_client = None
_client_api_key = None
_client_provider = None

CHUNK_SIZE = 12000
CHUNK_OVERLAP = 1000
CHUNK_BOUNDARY_WINDOW = 400
OPENROUTER_PRIMARY_MODEL = "google/gemini-3.1-flash-lite-preview"
OPENROUTER_FALLBACK_MODEL = "openai/gpt-oss-20b:free"
OPENAI_PRIMARY_MODEL = "gpt-4o-mini"
OPENAI_FALLBACK_MODEL = "gpt-3.5-turbo"


def _build_client(api_key: str, provider: str) -> OpenAI:
    if provider == "openrouter":
        return OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "SquadZero App",
            },
        )

    return OpenAI(api_key=api_key)


def _resolve_api_key(provider: str) -> str:
    """Resolve provider-specific API keys from environment variables."""
    if provider == "openrouter":
        # Backward compatibility: allow OPENAI_API_KEY to act as OpenRouter key.
        return os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or ""

    if provider == "openai":
        return os.getenv("OPENAI_API_KEY") or ""

    raise ValueError(f"Unsupported AI provider: {provider}")


def _get_client(provider: str = "openrouter") -> OpenAI:
    """
    Get or create OpenAI client - Lazy initialization pattern.
    
    This function creates the OpenRouter client only when needed (first use).
    This allows the app to start even if OPENAI_API_KEY is not set.
    
    Returns:
        OpenAI client instance pointing to OpenRouter
        
    Raises:
        ValueError: If OPENAI_API_KEY is not set in environment
    """
    global _client, _client_api_key, _client_provider

    api_key = _resolve_api_key(provider)
    if not api_key or "your_" in api_key:
        env_name = "OPENROUTER_API_KEY (or OPENAI_API_KEY for backward compatibility)" if provider == "openrouter" else "OPENAI_API_KEY"
        raise ValueError(f"{env_name} is not set correctly. Please add it to your environment or .env file.")

    # Guard against sending an OpenRouter key to OpenAI endpoints.
    if provider == "openai" and api_key.startswith("sk-or-"):
        raise ValueError(
            "OPENAI_API_KEY appears to be an OpenRouter key (sk-or-...). "
            "Please set OPENAI_API_KEY to a valid OpenAI key, or use OPENROUTER_API_KEY for OpenRouter."
        )

    if _client is None or _client_api_key != api_key or _client_provider != provider:
        _client = _build_client(api_key=api_key, provider=provider)
        _client_api_key = api_key
        _client_provider = provider

    return _client


def _split_text_with_overlap(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    """Split large text with overlap and soft sentence/paragraph boundaries."""
    cleaned = (text or "").strip()
    if not cleaned:
        return []

    chunks = []
    start = 0
    length = len(cleaned)

    while start < length:
        end = min(start + chunk_size, length)

        # Prefer cutting at a natural boundary near the chunk end.
        if end < length:
            window_start = max(start, end - CHUNK_BOUNDARY_WINDOW)
            boundary_candidates = [
                cleaned.rfind("\n\n", window_start, end),
                cleaned.rfind("\n", window_start, end),
                cleaned.rfind(". ", window_start, end),
                cleaned.rfind("; ", window_start, end),
            ]
            boundary = max(boundary_candidates)
            if boundary > window_start:
                if cleaned[boundary:boundary + 2] in {"\n\n", ". ", "; "}:
                    end = boundary + 2
                else:
                    end = boundary + 1

        chunk = cleaned[start:end]
        chunks.append(chunk)
        if end >= length:
            break
        start = max(end - overlap, start + 1)

    return chunks


def _chat_complete(client: OpenAI, model: str, messages, max_tokens: int, temperature: float):
    return client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )


def _generate_with_fallback(client: OpenAI, primary_model: str, fallback_model: str, messages, max_tokens: int):
    try:
        response = _chat_complete(
            client=client,
            model=primary_model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.4,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as primary_err:
        print(f"⚠️ [Warning] Primary model failed: {str(primary_err)}")
        fallback_response = _chat_complete(
            client=client,
            model=fallback_model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.4,
        )
        return (fallback_response.choices[0].message.content or "").strip()


def _looks_like_openrouter_auth_error(error: Exception) -> bool:
    message = str(error).lower()
    return "user not found" in message or "openrouter" in message or "401" in message or "unauthorized" in message


def _has_valid_openai_fallback_key() -> bool:
    """Return True only when OPENAI_API_KEY is suitable for direct OpenAI fallback."""
    key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if not key or "your_" in key:
        return False
    return not key.startswith("sk-or-")


def _generate_summary_via_provider(provider: str, messages, primary_model: str, fallback_model: str, max_tokens: int):
    client = _get_client(provider=provider)
    return _generate_with_fallback(
        client=client,
        primary_model=primary_model,
        fallback_model=fallback_model,
        messages=messages,
        max_tokens=max_tokens,
    )


def _is_summary_too_brief(summary: str, source_text: str, style: str) -> bool:
    """Basic quality gate to avoid returning very short or low-information summaries."""
    if not summary or len(summary.strip()) < 180:
        return True

    if style == "short":
        return False

    source_len = len((source_text or "").strip())
    if source_len <= 2000:
        # For short documents, still expect a reasonably complete response.
        return len(summary) < 280

    # For larger documents, require proportionally richer summaries.
    min_chars = max(420, int(source_len * 0.09))
    return len(summary) < min_chars


def _expand_summary_if_needed(
    client: OpenAI,
    primary_model: str,
    fallback_model: str,
    summary: str,
    source_text: str,
    style_instruction: str,
    style: str,
):
    if not _is_summary_too_brief(summary, source_text, style):
        return summary

    expand_messages = [
        {
            "role": "system",
            "content": (
                "You are an expert academic summarizer. Expand and improve the draft summary "
                "without adding fabricated facts."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Instruction: {style_instruction}\n\n"
                "The draft summary is too brief. Rewrite it into a more complete version.\n"
                "Requirements:\n"
                "1) Cover all major sections and core explanations.\n"
                "2) Keep clarity and structure with headings.\n"
                "3) Preserve factual accuracy and terminology.\n"
                "4) Avoid repetition and filler.\n\n"
                f"Source text:\n{source_text}\n\n"
                f"Current draft summary:\n{summary}"
            ),
        },
    ]

    expanded = _generate_with_fallback(
        client=client,
        primary_model=primary_model,
        fallback_model=fallback_model,
        messages=expand_messages,
        max_tokens=2200,
    )

    return expanded or summary

def generate_summary(text: str, style: str = "default") -> str:
    """
    Generate an AI-powered summary of text using OpenRouter.
    
    INTEGRATION POINT:
    - Called from: backend/routes/pdf.py generate_summary() endpoint
    - Output: AI-generated summary (string)
    - External Service: OpenRouter API
    """
    
    style_prompts = {
        "default": (
            "Create a detailed study-note summary in Markdown with clear headings and bullet points. "
            "Cover major sections, definitions, mechanisms, examples, and conclusions from the full text."
        ),
        "bullet": (
            "Provide a comprehensive Markdown bullet-point summary with section headings and sub-points "
            "for key concepts, processes, and examples."
        ),
        "short": "Provide a concise high-level summary in 5-7 sentences while preserving key takeaways."
    }
    
    style_instruction = style_prompts.get(style, style_prompts["default"])
    
    primary_model = "google/gemini-3.1-flash-lite-preview"
    fallback_model = "openai/gpt-oss-20b:free"
    
    # 1. Initialize API Client
    try:
        client = _get_client()
    except Exception as e:
        print(f"❌ [Error] API Key missing: {str(e)}")
        raise ValueError(f"Server configuration error: {str(e)}")
        
    print(f"🚀 [Info] Generating '{style}' summary for text (length: {len(text)} chars)")

    chunks = _split_text_with_overlap(text)
    if not chunks:
        raise ValueError("No text content provided for summarization.")

    system_prompt = (
        "You are an expert academic summarizer. Produce high-quality, faithful, detailed summaries. "
        "Do not invent facts. Keep terminology accurate. "
        "When style is default or bullet, format output as clean Markdown study notes with headings and bullet points."
    )

    if len(chunks) == 1:
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"Instruction: {style_instruction}\n\n"
                    "Output requirements:\n"
                    "1) Preserve all major topics and subtopics.\n"
                    "2) Mention definitions, mechanisms, and key explanations.\n"
                    "3) Include critical examples/processes/formulas when present.\n"
                    "4) Use Markdown headings and bullet points for readability.\n"
                    "5) Include a short 'Key Concepts' section and an 'Important Explanations' section.\n\n"
                    f"Source text:\n{text}"
                ),
            },
        ]
        summary = None
        try:
            summary = _generate_with_fallback(
                client=client,
                primary_model=primary_model,
                fallback_model=fallback_model,
                messages=messages,
                max_tokens=1800,
            )
        except Exception as ai_exc:
            if _looks_like_openrouter_auth_error(ai_exc):
                print("⚠️ [Warning] OpenRouter auth failed, retrying with direct OpenAI model...")
                if not _has_valid_openai_fallback_key():
                    raise ValueError(
                        "OpenRouter authentication failed and OPENAI_API_KEY is not configured for direct OpenAI fallback. "
                        "Set a valid OPENAI_API_KEY for fallback or fix OPENROUTER_API_KEY."
                    )
                summary = _generate_summary_via_provider(
                    provider="openai",
                    messages=messages,
                    primary_model=OPENAI_PRIMARY_MODEL,
                    fallback_model=OPENAI_FALLBACK_MODEL,
                    max_tokens=1800,
                )
            else:
                raise
        if not summary:
            raise ValueError("AI returned an empty summary.")
        summary = _expand_summary_if_needed(
            client=client,
            primary_model=primary_model,
            fallback_model=fallback_model,
            summary=summary,
            source_text=text,
            style_instruction=style_instruction,
            style=style,
        )
        return summary

    # Multi-pass summarization for large PDFs.
    chunk_summaries = []
    total_chunks = len(chunks)
    for index, chunk in enumerate(chunks, start=1):
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Summarize this segment in detail and preserve key technical/academic information.\n"
                    "Include: major ideas, definitions, steps/processes, examples, and notable conclusions.\n"
                    "Use compact headings.\n\n"
                    f"Segment {index}/{total_chunks}:\n{chunk}"
                ),
            },
        ]
        try:
            chunk_summary = _generate_with_fallback(
                client=client,
                primary_model=primary_model,
                fallback_model=fallback_model,
                messages=messages,
                max_tokens=1200,
            )
        except Exception as ai_exc:
            if _looks_like_openrouter_auth_error(ai_exc):
                print(f"⚠️ [Warning] OpenRouter auth failed for segment {index}, retrying with direct OpenAI...")
                if not _has_valid_openai_fallback_key():
                    raise ValueError(
                        "OpenRouter authentication failed and OPENAI_API_KEY is not configured for direct OpenAI fallback. "
                        "Set a valid OPENAI_API_KEY for fallback or fix OPENROUTER_API_KEY."
                    )
                chunk_summary = _generate_summary_via_provider(
                    provider="openai",
                    messages=messages,
                    primary_model=OPENAI_PRIMARY_MODEL,
                    fallback_model=OPENAI_FALLBACK_MODEL,
                    max_tokens=1200,
                )
            else:
                raise
        if chunk_summary:
            chunk_summaries.append(f"[Segment {index}]\n{chunk_summary}")

    if not chunk_summaries:
        raise ValueError("AI could not summarize any document segments.")

    combined_segment_summaries = "\n\n".join(chunk_summaries)
    final_messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                f"Instruction: {style_instruction}\n\n"
                "Merge the segment summaries into one coherent, comprehensive final summary of the full document.\n"
                "Requirements:\n"
                "1) Remove repetition while preserving all critical information.\n"
                "2) Organize with clear Markdown section headings.\n"
                "3) Cover the full document scope, including major explanations and conclusions.\n"
                "4) Ensure the result reads like complete study notes, not short notes.\n"
                "5) Use bullet points and sub-bullets where appropriate.\n\n"
                f"Segment summaries:\n{combined_segment_summaries}"
            ),
        },
    ]

    try:
        final_summary = _generate_with_fallback(
            client=client,
            primary_model=primary_model,
            fallback_model=fallback_model,
            messages=final_messages,
            max_tokens=2200,
        )
    except Exception as ai_exc:
        if _looks_like_openrouter_auth_error(ai_exc):
            print("⚠️ [Warning] OpenRouter auth failed for final merge, retrying with direct OpenAI...")
            if not _has_valid_openai_fallback_key():
                raise ValueError(
                    "OpenRouter authentication failed and OPENAI_API_KEY is not configured for direct OpenAI fallback. "
                    "Set a valid OPENAI_API_KEY for fallback or fix OPENROUTER_API_KEY."
                )
            final_summary = _generate_summary_via_provider(
                provider="openai",
                messages=final_messages,
                primary_model=OPENAI_PRIMARY_MODEL,
                fallback_model=OPENAI_FALLBACK_MODEL,
                max_tokens=2200,
            )
        else:
            raise

    if not final_summary:
        raise ValueError("AI returned an empty final summary.")

    final_summary = _expand_summary_if_needed(
        client=client,
        primary_model=primary_model,
        fallback_model=fallback_model,
        summary=final_summary,
        source_text=text,
        style_instruction=style_instruction,
        style=style,
    )

    return final_summary


def answer_question(question: str, context: str, highlighted_text: str = None) -> str:
    """
    Answer a question based on document context (Advanced Feature - Not Yet Used).
    
    This function is for future use when chat/Q&A feature is implemented.
    
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
    
    messages = [
        {
            "role": "system",
            "content": "You are a knowledgeable study assistant. Answer clearly, accurately, and with simple explanations when asked.",
        },
        {
            "role": "user",
            "content": prompt,
        },
    ]

    try:
        client = _get_client(provider="openrouter")
        print("DEBUG: Calling OpenRouter for Q&A")
        response = _chat_complete(
            client=client,
            model=OPENROUTER_PRIMARY_MODEL,
            messages=messages,
            max_tokens=600,
            temperature=0.4,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as openrouter_err:
        print(f"DEBUG: OpenRouter Q&A Error: {type(openrouter_err).__name__}: {str(openrouter_err)}")
        if _looks_like_openrouter_auth_error(openrouter_err):
            if not _has_valid_openai_fallback_key():
                raise ValueError(
                    "Error answering question: OpenRouter authentication failed and OPENAI_API_KEY is not configured for direct OpenAI fallback. "
                    "Set a valid OPENAI_API_KEY for fallback or fix OPENROUTER_API_KEY."
                )
            try:
                client = _get_client(provider="openai")
                response = _chat_complete(
                    client=client,
                    model=OPENAI_PRIMARY_MODEL,
                    messages=messages,
                    max_tokens=600,
                    temperature=0.4,
                )
                return (response.choices[0].message.content or "").strip()
            except Exception as openai_err:
                print(f"DEBUG: OpenAI Q&A Error: {type(openai_err).__name__}: {str(openai_err)}")
                raise ValueError(f"Error answering question: {str(openai_err)}")

        raise ValueError(f"Error answering question: {str(openrouter_err)}")