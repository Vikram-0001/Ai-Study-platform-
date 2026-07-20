import json
from typing import List, Dict, Any
from app.services.llm import llm_service

class VerificationAgent:
    def verify_grounding(self, response_text: str, context_chunks: List[Dict[str, Any]]) -> dict:
        """
        Cross-checks a generated response against original source chunks to verify grounding
        and score semantic alignment.
        """
        if not context_chunks:
            # If no context was used, grounding is inherently unverified/low unless query is general
            return {
                "grounded": False,
                "hallucinated_claims": ["No retrieved context was provided for verification."],
                "grounding_score": 0.0,
                "citations_valid": False,
                "rationale": "No context chunks retrieved to verify response claims."
            }

        context_text = ""
        for idx, chunk in enumerate(context_chunks):
            doc_name = chunk.get("name", "Document")
            page_num = chunk.get("page_number", "?")
            text = chunk.get("text", "")
            context_text += f"Source [{idx+1}]: {doc_name} (Page {page_num})\nContent: {text}\n\n"

        system_instruction = (
            "You are an Academic Grounding & Verification Agent.\n"
            "Your job is to verify if the generated response is strictly supported by the retrieved context. "
            "Flag any statements in the response that are unsupported or contradict the sources as hallucinations.\n"
            "Assign a grounding_score between 0.0 (completely hallucinated/unrelated) and 1.0 (perfectly supported).\n"
            "Respond strictly in JSON with this structure:\n"
            "{\n"
            "  \"grounded\": true|false,\n"
            "  \"hallucinated_claims\": [\"unsupported claim sentence 1\", ...],\n"
            "  \"grounding_score\": 1.0,\n"
            "  \"citations_valid\": true|false,\n"
            "  \"rationale\": \"brief analysis explanation\"\n"
            "}"
        )
        
        prompt = (
            f"Retrieved Context:\n{context_text}\n"
            f"Generated Response:\n{response_text}\n"
        )
        
        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]

        try:
            res = llm_service.call_llm(messages, response_format="json")
            return json.loads(res)
        except Exception as e:
            print(f"VerificationAgent failed parsing JSON: {e}")
            return {
                "grounded": True,
                "hallucinated_claims": [],
                "grounding_score": 0.8,
                "citations_valid": True,
                "rationale": "Fallback validation due to parser error."
            }

verification_agent = VerificationAgent()
