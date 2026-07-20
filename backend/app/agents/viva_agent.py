import json
from typing import List, Dict, Any
from app.services.llm import llm_service

class VivaAgent:
    def generate_viva(self, topic: str, context_chunks: List[Dict[str, Any]]) -> dict:
        """
        Generates Easy, Medium, and Hard viva (oral exam) questions and answers.
        """
        context_text = "\n\n".join([c.get("text", "") for c in context_chunks])
        
        system_instruction = (
            "You are an academic viva external examiner. Generate a list of viva questions "
            "evaluating the student on the selected topic using the provided study content.\n"
            "Format the output strictly as JSON with the following structure:\n"
            "{\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"level\": \"Easy|Medium|Hard\",\n"
            "      \"question\": \"Question text\",\n"
            "      \"answer\": \"Detailed ideal response for examiner reference\"\n"
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
            print(f"VivaAgent failed parsing JSON: {e}")
            return {"questions": []}

viva_agent = VivaAgent()
