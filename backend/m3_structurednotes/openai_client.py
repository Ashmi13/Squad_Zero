"""
M3 Structured Notes — AI Client (no LangChain)

Follows the same pattern as M4 (openai_service.py): raw openai.OpenAI()
pointed at OpenRouter, with env-driven model selection.
"""

import os
import time
import logging
from typing import Optional

import openai
from openai import OpenAI, APIError, RateLimitError, APIConnectionError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton helpers
# ---------------------------------------------------------------------------

_client: Optional[OpenAI] = None
_model: Optional[str] = None
_fallback_model: Optional[str] = None


def _get_api_key() -> str:
    """Return the first available OpenRouter/OpenAI key from the environment."""
    for var in ("OPENROUTER_API_KEY", "OPENAI_API_KEY"):
        key = (os.getenv(var) or "").strip()
        if key:
            return key
    raise RuntimeError(
        "No API key found. Set OPENROUTER_API_KEY or OPENAI_API_KEY in .env"
    )


def get_model() -> str:
    """Return the configured model name (env-driven, same as M4)."""
    global _model
    if _model is not None:
        return _model

    _model = (os.getenv("OPENROUTER_MODEL") or "").strip()
    if not _model:
        _model = "google/gemini-3.1-flash-lite-preview"  # matches M4 primary model
        logger.warning("OPENROUTER_MODEL not set — defaulting to %s", _model)
    else:
        logger.info("M3 AI client using model: %s", _model)
    return _model


def get_fallback_model() -> str:
    """Return a safe fallback model that is known to work."""
    global _fallback_model
    if _fallback_model is not None:
        return _fallback_model
    _fallback_model = "openai/gpt-oss-20b:free"
    return _fallback_model


def get_client() -> OpenAI:
    """Return (and cache) the raw OpenAI client pointed at OpenRouter."""
    global _client
    if _client is not None:
        return _client

    api_key = _get_api_key()
    _client = OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": os.getenv("BACKEND_URL", "http://localhost:8000"),
            "X-Title": "SquadZero M3 Structured Notes",
        },
        timeout=180.0,  # long enough for big cheatsheet responses
    )
    logger.info("M3 AI client initialised (OpenRouter)")
    return _client


# ---------------------------------------------------------------------------
# LLM call helpers
# ---------------------------------------------------------------------------

def ask_llm(
    prompt: str,
    *,
    system: str = "You are an expert academic note-taker and cheatsheet creator.",
    temperature: float = 0.3,
    max_tokens: int = 16384,
    top_p: float = 0.95,
) -> str:
    """Single synchronous chat-completion call with retry/backoff and model fallback."""
    client = get_client()
    model = get_model()
    fallback = get_fallback_model()

    backoff = 5.0  # seconds
    last_error: Optional[Exception] = None

    for model_to_try in (model, fallback):
        for attempt in range(3):
            try:
                resp = client.chat.completions.create(
                    model=model_to_try,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=top_p,
                )
                content = resp.choices[0].message.content or ""
                if model_to_try != model:
                    logger.info("Primary model %s failed, succeeded with fallback %s", model, model_to_try)
                return content

            except RateLimitError as e:
                logger.warning("Rate-limited (model=%s attempt %d/3), waiting %.1fs", model_to_try, attempt + 1, backoff)
                last_error = e
                time.sleep(backoff)
                backoff *= 2.0

            except (APIError, APIConnectionError) as e:
                logger.warning("API/connection error (model=%s attempt %d/3): %s", model_to_try, attempt + 1, e)
                last_error = e
                # Don't retry if the model simply doesn't exist (404)
                if hasattr(e, 'status_code') and e.status_code == 404:
                    break
                time.sleep(backoff)
                backoff *= 2.0

        # If we got here, model_to_try failed; reset backoff for fallback attempt
        backoff = 5.0

    raise RuntimeError(f"LLM call failed after trying models [{model}, {fallback}]. Last error: {last_error}")
