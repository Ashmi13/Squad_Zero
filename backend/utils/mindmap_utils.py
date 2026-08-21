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
        """
        Generate hierarchical mind map structure from text using OpenAI.
        Ensures hierarchical colors and meaningful end node content.
        """
        
        # IMPROVED SYSTEM PROMPT - Clear instructions for better output
        system_prompt = """You are an expert educational mind map creator specializing in creating clear, hierarchical, non-redundant mind maps.

CRITICAL RULES:
1. Create 4-7 main branches (depth 0) - these are the core concepts
2. Each main branch has 2-4 sub-branches (depth 1) - supporting ideas
3. Each sub-branch has 2-3 details/examples (depth 2-3) - concrete information
4. NEVER leave end nodes (leaf nodes) empty or with vague content
5. Every end node MUST have meaningful content - key facts, specific examples, or important details
6. Use hierarchical colors based on depth:
   - Depth 0 (Main): #6366f1 (Indigo) - Core concepts
   - Depth 1 (Sub): #10b981 (Green) - Learning material
   - Depth 2 (Details): #f59e0b (Orange) - Specific examples
   - Depth 3+ (Points): #ec4899 (Pink) - Key facts to memorize

OUTPUT VALIDATION:
- Every end node must have meaningful 'notes' field (not empty, not generic)
- No node should have empty content
- Ensure proper hierarchy depth progression"""
        
        # IMPROVED USER PROMPT - Better instructions for structure
        user_prompt = f"""Analyze this PDF text and create a comprehensive mind map for studying.

IMPORTANT REQUIREMENTS:
1. Generate 4-7 main topics (these become Indigo #6366f1 nodes)
2. Each main topic should have 2-4 subtopics (Green #10b981 nodes)
3. Each subtopic should have 2-3 details or examples (Orange #f59e0b and Pink #ec4899 nodes)
4. NO END NODES CAN BE EMPTY - Every leaf node must have a 'notes' field with:
   - Specific facts from the text
   - Concrete examples or statistics
   - Key points to remember
   - Clear, actionable information

Return ONLY valid JSON with this structure (no markdown, no code blocks):
{{
  "branches": [
    {{
      "content": "Main Topic Name",
      "color": "#6366f1",
      "notes": "Optional overview of this main topic",
      "children": [
        {{
          "content": "Sub-Topic",
          "color": "#10b981",
          "notes": "What this subtopic covers",
          "children": [
            {{
              "content": "Specific Example or Fact",
              "color": "#f59e0b",
              "notes": "REQUIRED: Specific detail, fact, or example from the text"
            }},
            {{
              "content": "Another Key Point",
              "color": "#f59e0b",
              "notes": "REQUIRED: Another specific fact or example"
            }}
          ]
        }}
      ]
    }}
  ]
}}

TEXT TO ANALYZE (first 5000 characters):
{text[:5000]}

REMEMBER: Every single end node MUST have meaningful notes with specific information!"""

        try:
            # Call OpenAI API
            # Call OpenAI API enforcing JSON mode output
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                response_format={"type": "json_object"}
            )
        except Exception as e:
            raise ValueError(f"OpenAI completion request failed: {str(e)}")

        # Extract response
        raw_content = response.choices[0].message.content
        if not raw_content:
            raise ValueError("OpenAI returned an empty content response.")

        raw_content = raw_content.strip()

        # Handle markdown code blocks
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

        # Validate structure
        if not self._validate_structure(structure):
            raise ValueError("Generated mind map structure failed validation.")

        # ENSURE ALL END NODES HAVE CONTENT
        self._validate_end_nodes_have_content(structure)

        return structure

    def _validate_structure(self, structure: Dict) -> bool:
        """Validate that structure has correct format"""
        if not isinstance(structure, dict):
            return False
        if "branches" not in structure:
            return False
        branches = structure["branches"]
        
        if not isinstance(branches, list) or len(branches) == 0:
            return False
            
        for branch in branches:
            if not self._validate_node(branch):
                return False
        return True

    def _validate_node(self, node: Dict, max_depth=5, current_depth=0) -> bool:
        """Validate individual node structure"""
        if not isinstance(node, dict):
            return False
        
        # Check required content field
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

    def _validate_end_nodes_have_content(self, structure: Dict) -> None:
        """
        Ensure all end nodes (leaf nodes) have meaningful notes.
        If an end node is missing notes, use its content as fallback.
        """
        def validate_recursive(node):
            """Recursively check and fix end nodes"""
            if not isinstance(node, dict):
                return
            
            # Check if this is an end node (has no children or empty children)
            has_children = node.get("children") and isinstance(node["children"], list) and len(node["children"]) > 0
            
            if has_children:
                # Not an end node, recurse to children
                for child in node["children"]:
                    validate_recursive(child)
            else:
                # This IS an end node - ensure it has notes
                if not node.get("notes") or str(node.get("notes", "")).strip() == "":
                    # Use content as fallback notes
                    node["notes"] = f"{node.get('content', 'Key concept')} - Important point to remember"
                    logger.info(f"Auto-filled notes for end node: {node.get('content')}")
        
        # Process all branches
        if "branches" in structure and isinstance(structure["branches"], list):
            for branch in structure["branches"]:
                validate_recursive(branch)

    def estimate_cost(self, text_length: int) -> Dict:
        """Estimate API cost for text generation"""
        # Estimate tokens (1 char ≈ 0.25 tokens)
        est_input_tokens = int(text_length * 0.25)
        # Estimate output tokens as ~30% of input, capped at max_tokens and at least 200
        est_output_tokens = min(self.max_tokens, max(200, int(est_input_tokens * 0.3)))

        # Calculate cost based on model
        if "gpt-4" in self.model.lower():
            input_cost_per_million = 5.00  # GPT-4 is more expensive
            output_cost_per_million = 15.00
        elif "gpt-3.5" in self.model.lower() or "mini" in self.model.lower():
            input_cost_per_million = 0.50  # GPT-3.5-turbo / 4o-mini cheaper
            output_cost_per_million = 1.50
        else:
            # Default/fallback
            input_cost_per_million = 1.00
            output_cost_per_million = 3.00

        est_input_cost = est_input_tokens * (input_cost_per_million / 1_000_000)
        est_output_cost = est_output_tokens * (output_cost_per_million / 1_000_000)
        est_total_cost = est_input_cost + est_output_cost

        return {
            "model": self.model,
            "est_input_tokens": est_input_tokens,
            "est_output_tokens": est_output_tokens,
            "est_input_cost": round(est_input_cost, 6),
            "est_output_cost": round(est_output_cost, 6),
            "est_total_cost": round(est_total_cost, 6)
        }
