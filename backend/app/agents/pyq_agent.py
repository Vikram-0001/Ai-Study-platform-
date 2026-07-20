import json
from typing import List, Dict, Any
from app.services.llm import llm_service

class PYQAgent:
    def analyze_pyqs(self, topic: str, context_chunks: List[Dict[str, Any]]) -> dict:
        """
        Analyzes past question materials in context, predicting weights, topic importance,
        and probabilities of question categories appearing in assessments.
        """
        context_text = "\n\n".join([c.get("text", "") for c in context_chunks])
        
        system_instruction = (
            "You are an academic exam evaluation system. Review the context papers, mock tests, or syllabus guidelines "
            "provided to identify high-probability questions and predict topic distributions.\n"
            "Format the output strictly as JSON with this structure:\n"
            "{\n"
            "  \"repeated_questions\": [\n"
            "    {\n"
            "      \"question\": \"Question content text\",\n"
            "      \"frequency\": \"e.g., Appeared 4 times in 5 years\",\n"
            "      \"weightage\": \"e.g., 10 marks\"\n"
            "    }\n"
            "  ],\n"
            "  \"important_topics\": [\n"
            "    {\n"
            "      \"topic\": \"Syllabus unit / Sub-topic\",\n"
            "      \"probability\": \"e.g., 90% (Very High)\",\n"
            "      \"difficulty_trend\": \"Description of how questions are structured\"\n"
            "    }\n"
            "  ]\n"
            "}"
        )
        
        prompt = f"Topic/Syllabus: {topic}\n\nContext files:\n{context_text}"
        
        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]

        try:
            res = llm_service.call_llm(messages, response_format="json")
            return json.loads(res)
        except Exception as e:
            print(f"PYQAgent failed parsing JSON: {e}")
            return {
                "repeated_questions": [],
                "important_topics": []
            }

pyq_agent = PYQAgent()
