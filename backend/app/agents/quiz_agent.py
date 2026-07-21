import json
from typing import List, Dict, Any
from app.services.llm import llm_service

class QuizAgent:
    def generate_quiz(self, topic: str, context_chunks: List[Dict[str, Any]]) -> dict:
        """
        Generates structured quizzes matching MCQs, coding challenges, T/F, and fill-in-blanks formats.
        """
        context_text = "\n\n".join([c.get("text", "") for c in context_chunks])
        
        system_instruction = (
            "You are an academic testing supervisor. "
            "Design a quiz covering the requested topic, pulling details from the context materials.\n"
            "Generate at least 10 questions spanning: Multiple Choice (mcq), True/False (true_false), "
            "Fill in the Blanks (fill_in_blanks), and a Coding/Short Answer (coding).\n"
            "Return JSON format:\n"
            "{\n"
            "  \"title\": \"Quiz Title\",\n"
            "  \"questions\": [\n"
            "    {\n"
            "      \"type\": \"mcq|true_false|fill_in_blanks|coding\",\n"
            "      \"question\": \"text\",\n"
            "      \"options\": [\"opt1\", \"opt2\"] (only for mcq and true_false),\n"
            "      \"answer\": \"exact correct answer text\",\n"
            "      \"explanation\": \"rationale\"\n"
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
            print(f"QuizAgent failed parsing JSON: {e}")
            # Return basic format
            return {
                "title": f"Quiz: {topic}",
                "questions": []
            }

quiz_agent = QuizAgent()
