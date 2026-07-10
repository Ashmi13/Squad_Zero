import os
import json
import re
import logging
from typing import Dict
from openai import OpenAI

logger = logging.getLogger(__name__)


class MindMapGenerator:
    def __init__(self) -> None:
        # Retrieve API key prioritizing OPENROUTER_API_KEY
        api_key = (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY") or "").strip()
        
        # Check if the key belongs to OpenRouter
        is_openrouter = api_key.startswith("sk-or-v1-") or bool(os.getenv("OPENROUTER_API_KEY"))
        
        if is_openrouter:
            self.client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1",
                default_headers={
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "NeuraNote"
                }
            )
            # Default to OpenRouter model
            self.model = os.getenv("OPENROUTER_MODEL") or os.getenv("OPENAI_MODEL") or "openai/gpt-4o-mini"
            # If the env is still set to legacy openai model, switch to openrouter default
            if self.model == "gpt-3.5-turbo":
                self.model = "openai/gpt-4o-mini"
        else:
            self.client = OpenAI(api_key=api_key or None)
            self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        
        try:
            self.max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
        except ValueError:
            self.max_tokens = 2000
            
        try:
            self.temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.7"))
        except ValueError:
            self.temperature = 0.7

    def generate_structure(self, text: str) -> Dict:
        # Create system prompt
        system_prompt = "You are an expert at creating non-redundant mind maps with 4-7 main branches"
        
        # Create user prompt
        user_prompt = (
            "Analyze this PDF text and return JSON with branches/children structure.\n\n"
            "Colors to use:\n"
            "- #6366f1 (Indigo) for core concepts\n"
            "- #10b981 (Green) for learning/material\n"
            "- #f59e0b (Orange) for examples\n"
            "- #ec4899 (Pink) for important details\n\n"
            "Output format must be a JSON object with a single 'branches' list, where each branch contains:\n"
            "- 'content': string (1-500 characters, required)\n"
            "- 'color': string (HEX, optional, e.g. '#6366f1')\n"
            "- 'notes': string (optional)\n"
            "- 'children': list (optional, list of child node structures)\n\n"
            f"Text to analyze:\n{text}"
        )

        try:
            # Call client.chat.completions.create()
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
        except Exception as e:
            raise ValueError(f"OpenAI completion request failed: {str(e)}")

        # Extract response from response.choices[0].message.content
        raw_content = response.choices[0].message.content
        if not raw_content:
            raise ValueError("OpenAI returned an empty content response.")

        raw_content = raw_content.strip()

        # Handle markdown code blocks (if wrapped in ```)
        if raw_content.startswith("```"):
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw_content, re.DOTALL)
            if match:
                raw_content = match.group(1).strip()

        # Parse JSON
        try:
            structure = json.loads(raw_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse OpenAI JSON response: {str(e)}") from e

        # Log token usage
        usage = response.usage
        if usage:
            print(f"Token usage - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
            logger.info(f"OpenAI Token usage - Prompt: {usage.prompt_tokens}, Completion: {usage.completion_tokens}, Total: {usage.total_tokens}")
        else:
            print("Token usage: Not available")

        # Validate structure
        if not self._validate_structure(structure):
            raise ValueError("Generated mind map structure failed validation.")

        return structure

    def _validate_structure(self, structure: Dict) -> bool:
        # Check "branches" key exists
        if not isinstance(structure, dict):
            return False
        if "branches" not in structure:
            return False
        branches = structure["branches"]
        
        # Check it's a non-empty list
        if not isinstance(branches, list) or len(branches) == 0:
            return False
            
        # Call _validate_node() for each branch
        for branch in branches:
            if not self._validate_node(branch):
                return False
        return True

    def _validate_node(self, node: Dict, max_depth=3, current_depth=0) -> bool:
        if not isinstance(node, dict):
            return False
        
        # Check required fields
        if "content" not in node or not isinstance(node["content"], str) or not node["content"].strip():
            return False

        if current_depth > max_depth:
            return False

        # Validate children recursively
        if "children" in node and node["children"] is not None:
            children = node["children"]
            if not isinstance(children, list):
                return False
            for child in children:
                if not self._validate_node(child, max_depth, current_depth + 1):
                    return False
        return True

    def estimate_cost(self, text_length: int) -> Dict:
        # Estimate tokens (1 char ≈ 0.25 tokens)
        est_input_tokens = int(text_length * 0.25)
        # Estimate output tokens as ~30% of input, capped at max_tokens and at least 200
        est_output_tokens = min(self.max_tokens, max(200, int(est_input_tokens * 0.3)))

        # Calculate cost for GPT-3.5-turbo: $0.50 per 1M input, $1.50 per 1M output
        est_input_cost = est_input_tokens * (0.50 / 1_000_000)
        est_output_cost = est_output_tokens * (1.50 / 1_000_000)
        est_total_cost = est_input_cost + est_output_cost

        return {
            "model": self.model,
            "est_input_tokens": est_input_tokens,
            "est_output_tokens": est_output_tokens,
            "est_input_cost": round(est_input_cost, 6),
            "est_output_cost": round(est_output_cost, 6),
            "est_total_cost": round(est_total_cost, 6)
        }
