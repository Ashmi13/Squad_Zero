import os
from pathlib import Path
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, UploadFile
from app.db.supabase import get_supabase
from services.pdf_service import PDFService
from utils.mindmap_utils import MindMapGenerator


def build_node_tree(nodes_list):
    """
    Transforms a flat list of nodes into a nested tree structure
    where each node has a 'children' list populated.
    """
    nodes_by_id = {node["id"]: {**node, "children": []} for node in nodes_list}
    root_nodes = []
    
    for node_id, node in nodes_by_id.items():
        parent_id = node.get("parent_id")
        if parent_id is None:
            root_nodes.append(node)
        else:
            if parent_id in nodes_by_id:
                nodes_by_id[parent_id]["children"].append(node)
            else:
                root_nodes.append(node)
    return root_nodes


class MindMapService:
    def __init__(self, supabase_client=None):
        self.supabase = supabase_client or get_supabase().service_client
        self.pdf_service = PDFService()
        self.generator = MindMapGenerator()

    async def generate_from_pdf(
        self,
        file: UploadFile,
        user_id: str,
        title: str,
        description: Optional[str] = None
    ) -> dict:
        # Validate file is PDF
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Uploaded file must be a PDF")

        # Create uploads/mindmaps directory
        upload_dir = Path("uploads/mindmaps")
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Save file temporarily
        temp_filename = f"{uuid.uuid4()}_{file.filename}"
        temp_file_path = upload_dir / temp_filename

        try:
            content = await file.read()
            with open(temp_file_path, "wb") as f:
                f.write(content)

            # Extract text using self.pdf_service.extract_text()
            try:
                text = self.pdf_service.extract_text(str(temp_file_path))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            # Check text length >= 100 chars
            if len(text) < 100:
                raise HTTPException(
                    status_code=400,
                    detail="PDF text content must be at least 100 characters to generate a mind map."
                )

            # Estimate cost
            cost_est = self.generator.estimate_cost(len(text))

            # Generate structure
            try:
                structure = self.generator.generate_structure(text)
            except ValueError as e:
                raise HTTPException(status_code=502, detail=f"AI generation failed: {str(e)}")

            # Create MindMap payload
            mindmap_payload = {
                "user_id": user_id,
                "title": title,
                "description": description,
                "source_filename": file.filename,
                "source_text": text,
                "ai_model": self.generator.model,
                "estimated_cost": cost_est.get("est_total_cost", 0.0),
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            # Insert mindmap into Supabase
            res = self.supabase.table("mindmaps").insert(mindmap_payload).execute()
            if not res.data:
                raise HTTPException(status_code=500, detail="Failed to create mind map in database")

            mindmap_data = res.data[0]
            mindmap_id = mindmap_data["id"]

            # Call _create_nodes_from_structure()
            self._create_nodes_from_structure(mindmap_id, structure)

            # Create corresponding note in notes table so it integrates with folders/sidebar tree
            try:
                note_id = f"mindmap_{mindmap_id}"
                note_title = f"{title} — Mind Map"
                note_payload = {
                    "note_id": note_id,
                    "user_id": user_id,
                    "title": note_title,
                    "content": f"Mind map generated from {file.filename}.",
                    "note_type": "MINDMAP",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                self.supabase.table("notes").insert(note_payload).execute()
                print(f"[MINDMAP] Successfully synced mindmap_{mindmap_id} to notes table.")
            except Exception as notes_err:
                print(f"[MINDMAP] Failed to sync mindmap to notes table: {notes_err}")

            # Retrieve count of nodes
            nodes_res = self.supabase.table("mindmap_nodes").select("id", count="exact").eq("mindmap_id", mindmap_id).execute()
            nodes_count = nodes_res.count if nodes_res.count is not None else 0

            return {
                "mindmap_id": mindmap_id,
                "title": mindmap_data["title"],
                "status": mindmap_data["status"],
                "nodes_count": nodes_count,
                "ai_model": mindmap_data["ai_model"],
                "estimated_cost": mindmap_data["estimated_cost"],
                "source_filename": mindmap_data["source_filename"],
                "created_at": mindmap_data.get("created_at") or datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"Failed to generate mind map: {str(e)}")

        finally:
            # Clean up temp file
            if temp_file_path.exists():
                try:
                    os.remove(temp_file_path)
                except Exception:
                    pass

    def _create_nodes_from_structure(self, mindmap_id: int, structure: Dict, parent_id: Optional[int] = None):
        if "branches" in structure:
            nodes_to_process = structure["branches"]
        elif "children" in structure:
            nodes_to_process = structure["children"]
        elif isinstance(structure, list):
            nodes_to_process = structure
        else:
            return

        if not isinstance(nodes_to_process, list):
            return

        for node_data in nodes_to_process:
            node_payload = {
                "mindmap_id": mindmap_id,
                "parent_id": parent_id,
                "content": node_data.get("content", "")[:500],
                "notes": node_data.get("notes"),
                "color": node_data.get("color", "#6366f1"),
                "position_x": 0.0,
                "position_y": 0.0,
                "is_expanded": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            res = self.supabase.table("mindmap_nodes").insert(node_payload).execute()
            if not res.data:
                continue

            created_node = res.data[0]
            node_id = created_node["id"]

            # Recursively process children
            if "children" in node_data and node_data["children"]:
                self._create_nodes_from_structure(mindmap_id, node_data, parent_id=node_id)

    # CRUD Methods

    def get_mindmap(self, mindmap_id: int, user_id: str) -> dict:
        res = self.supabase.table("mindmaps").select("*").eq("id", mindmap_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Mind map not found")
        mindmap = res.data[0]
        if mindmap["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this mind map")
        
        # Fetch nodes
        nodes_res = self.supabase.table("mindmap_nodes").select("*").eq("mindmap_id", mindmap_id).execute()
        mindmap["nodes"] = build_node_tree(nodes_res.data or [])
        return mindmap

    def create_node(self, mindmap_id: int, user_id: str, node_in) -> dict:
        # Check authorization
        self.get_mindmap(mindmap_id, user_id)

        # If parent_id is provided, check if it belongs to the same mind map
        if node_in.parent_id is not None:
            parent_res = self.supabase.table("mindmap_nodes").select("id").eq("id", node_in.parent_id).eq("mindmap_id", mindmap_id).execute()
            if not parent_res.data:
                raise HTTPException(status_code=400, detail="Invalid parent node ID")

        # Create node payload
        node_payload = {
            "mindmap_id": mindmap_id,
            "parent_id": node_in.parent_id,
            "content": node_in.content,
            "notes": node_in.notes,
            "color": node_in.color or "#6366f1",
            "position_x": 0.0,
            "position_y": 0.0,
            "is_expanded": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        res = self.supabase.table("mindmap_nodes").insert(node_payload).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create node")
        
        return {**res.data[0], "children": []}

    def update_node(self, node_id: int, user_id: str, node_in) -> dict:
        node_res = self.supabase.table("mindmap_nodes").select("*").eq("id", node_id).execute()
        if not node_res.data:
            raise HTTPException(status_code=404, detail="Node not found")
        node = node_res.data[0]
        
        # Check authorization through parent mindmap
        self.get_mindmap(node["mindmap_id"], user_id)

        # Update fields if provided
        update_data = {}
        if node_in.content is not None:
            update_data["content"] = node_in.content
        if node_in.notes is not None:
            update_data["notes"] = node_in.notes
        if node_in.color is not None:
            update_data["color"] = node_in.color
        if node_in.position_x is not None:
            update_data["position_x"] = node_in.position_x
        if node_in.position_y is not None:
            update_data["position_y"] = node_in.position_y
        if node_in.is_expanded is not None:
            update_data["is_expanded"] = node_in.is_expanded

        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = self.supabase.table("mindmap_nodes").update(update_data).eq("id", node_id).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update node")
        
        # Preserve local children representation (default to empty if not fetched)
        return {**res.data[0], "children": []}

    def delete_node(self, node_id: int, user_id: str) -> dict:
        node_res = self.supabase.table("mindmap_nodes").select("mindmap_id").eq("id", node_id).execute()
        if not node_res.data:
            raise HTTPException(status_code=404, detail="Node not found")
        node = node_res.data[0]

        # Check authorization through parent mindmap
        self.get_mindmap(node["mindmap_id"], user_id)

        self.supabase.table("mindmap_nodes").delete().eq("id", node_id).execute()
        return {"message": "Node deleted successfully"}

    def get_node_children(self, node_id: int, user_id: str) -> List[dict]:
        node_res = self.supabase.table("mindmap_nodes").select("mindmap_id").eq("id", node_id).execute()
        if not node_res.data:
            raise HTTPException(status_code=404, detail="Node not found")
        node = node_res.data[0]

        # Check authorization through parent mindmap
        self.get_mindmap(node["mindmap_id"], user_id)

        children_res = self.supabase.table("mindmap_nodes").select("*").eq("parent_id", node_id).execute()
        return children_res.data or []

    def list_user_mindmaps(self, user_id: str, skip: int = 0, limit: int = 10) -> List[dict]:
        res = self.supabase.table("mindmaps").select("*").eq("user_id", user_id).range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        mindmaps = res.data or []
        
        for mm in mindmaps:
            nodes_res = self.supabase.table("mindmap_nodes").select("*").eq("mindmap_id", mm["id"]).execute()
            mm["nodes"] = build_node_tree(nodes_res.data or [])
            
        return mindmaps

    def delete_mindmap(self, mindmap_id: int, user_id: str) -> dict:
        # Check authorization
        self.get_mindmap(mindmap_id, user_id)

        self.supabase.table("mindmaps").delete().eq("id", mindmap_id).execute()
        try:
            self.supabase.table("notes").delete().eq("note_id", f"mindmap_{mindmap_id}").execute()
        except Exception:
            pass
        return {"message": "Mind map deleted successfully"}

    def get_usage_stats(self, user_id: str) -> dict:
        res = self.supabase.table("mindmaps").select("*").eq("user_id", user_id).execute()
        mindmaps = res.data or []
        
        total_mindmaps = len(mindmaps)
        
        costs = [mm.get("estimated_cost") for mm in mindmaps if mm.get("estimated_cost") is not None]
        total_cost = sum(costs)
        average_cost = total_cost / total_mindmaps if total_mindmaps > 0 else 0.0
        
        model_usage = {}
        for mm in mindmaps:
            model = mm.get("ai_model") or "unknown"
            model_usage[model] = model_usage.get(model, 0) + 1
            
        return {
            "total_mindmaps": total_mindmaps,
            "total_cost": round(total_cost, 6),
            "average_cost": round(average_cost, 6),
            "model_usage": model_usage
        }
