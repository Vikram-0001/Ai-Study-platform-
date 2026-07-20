import json
from app.services.llm import llm_service

class DecisionAgent:
    def classify_intent(self, query: str) -> dict:
        """
        Classifies the incoming user query.
        Returns:
            dict containing keys: 'intent' ('factual' or 'reasoning'),
            'requires_llm' (bool), and 'confidence' (float).
        """
        # Heuristic fast path: common keywords for reasoning/generation
        query_lower = query.strip().lower()
        reasoning_keywords = [
            "explain", "compare", "differentiate", "generate", "create", "summarize",
            "why", "how", "what is the difference", "quiz", "viva", "flashcard",
            "study plan", "roadmap", "notes on", "cheat sheet", "predict", "pyq"
        ]
        
        import re
        # If it matches any of these, it's definitely reasoning/generation
        for keyword in reasoning_keywords:
            # Match whole-word boundary, or substring if keyword has spaces (multi-word phrases)
            has_match = False
            if " " in keyword:
                has_match = keyword in query_lower
            else:
                has_match = bool(re.search(r"\b" + re.escape(keyword) + r"\b", query_lower))

            if has_match:
                return {
                    "intent": "reasoning",
                    "requires_llm": True,
                    "confidence": 0.99,
                    "reasoning": f"Fast-path trigger: query matches keyword '{keyword}'"
                }


        # Otherwise, query the LLM model to determine classification
        system_instruction = (
            "You are an intent classification agent inside an Academic Assistant. "
            "Your job is to classify the user's intent to save LLM tokens.\n"
            "If the user wants a simple factual retrieval, a definition, slides, list of files, "
            "or locations (e.g., 'What is Binary Search?', 'Show DBMS notes', 'Where is Deadlock explained?'), "
            "then classify as 'factual' (requires_llm = false).\n"
            "If the user wants complex analysis, explanation in simple terms, comparison, "
            "or content generation (e.g., 'Explain binary search to a beginner', 'Compare merge and quick sort', "
            "'Generate questions'), classify as 'reasoning' (requires_llm = true).\n"
            "Reply strictly in JSON: {\"intent\": \"factual\"|\"reasoning\", \"requires_llm\": true|false, \"confidence\": float, \"reasoning\": \"string\"}"
        )
        
        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": f"Query: {query}"}
        ]

        try:
            response_text = llm_service.call_llm(messages, response_format="json")
            data = json.loads(response_text)
            return data
        except Exception as e:
            print(f"Decision agent classification failed: {e}. Falling back to default factual.")
            return {
                "intent": "factual",
                "requires_llm": False,
                "confidence": 0.5,
                "reasoning": "Fallback on classification failure."
            }

decision_agent = DecisionAgent()
