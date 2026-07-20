import json
from typing import List, Dict, Any
from app.services.llm import llm_service

class RevisionAgent:
    def generate_revision_notes(self, topic: str, context_chunks: List[Dict[str, Any]]) -> dict:
        """
        Generates short notes, long notes, and quick cheat sheets from the study context.
        """
        context_text = "\n\n".join([c.get("text", "") for c in context_chunks])
        
        system_instruction = (
            "You are an academic learning writer. Create an study deck summarizing critical concepts "
            "for the requested topic based on context materials.\n"
            "Format the output strictly as JSON with this structure:\n"
            "{\n"
            "  \"summary\": \"Overall high level summaries of the subject\",\n"
            "  \"cheat_sheet\": \"Markdown list of quick formulas, facts, or definitions\",\n"
            "  \"notes\": [\n"
            "    {\n"
            "      \"topic\": \"Sub-topic title\",\n"
            "      \"details\": \"In-depth revision notes explaining the concept\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        
        prompt = f"Topic: {topic}\n\nContext:\n{context_text}"
        
        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]

        try:
            res = llm_service.call_llm(messages, response_format="json")
            return json.loads(res)
        except Exception as e:
            print(f"RevisionAgent failed parsing JSON: {e}")
            return {
                "summary": "Notes summary",
                "cheat_sheet": "",
                "notes": []
            }

revision_agent = RevisionAgent()
