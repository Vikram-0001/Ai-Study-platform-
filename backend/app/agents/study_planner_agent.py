import json
from typing import List, Dict, Any
from app.services.llm import llm_service

class StudyPlannerAgent:
    def create_study_plan(self, topic: str, context_chunks: List[Dict[str, Any]]) -> dict:
        """
        Creates a custom study schedule and roadmap to learn a given academic topic.
        """
        context_text = "\n\n".join([c.get("text", "") for c in context_chunks])
        
        system_instruction = (
            "You are a Senior Academic Guidance Counselor. Prepare a custom study roadmap "
            "and schedule for a student aiming to master the topic using context references.\n"
            "Format the output strictly as JSON with this structure:\n"
            "{\n"
            "  \"topic\": \"The core topic\",\n"
            "  \"plan_data\": [\n"
            "    {\n"
            "      \"day\": \"Day / Step number (e.g. Day 1)\",\n"
            "      \"objective\": \"Goals for this phase\",\n"
            "      \"tasks\": [\n"
            "        \"Specific reading or practice task\"\n"
            "      ]\n"
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
            print(f"StudyPlannerAgent failed parsing JSON: {e}")
            return {
                "topic": topic,
                "plan_data": []
            }

study_planner_agent = StudyPlannerAgent()
