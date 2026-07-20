from typing import List, Dict, Any
from app.services.llm import llm_service

class ReasoningAgent:
    def synthesize_answer(self, query: str, context_chunks: List[Dict[str, Any]]) -> str:
        """
        Synthesizes an academic explanation based on retrieved chunks.
        """
        # Format the context for the LLM
        formatted_context = ""
        for i, chunk in enumerate(context_chunks):
            doc_name = chunk.get("name", "Document")
            page_num = chunk.get("page_number", "?")
            text = chunk.get("text", "")
            formatted_context += f"Source [{i+1}]: {doc_name} (Page {page_num})\nContent: {text}\n\n"

        system_instruction = (
            "You are a Senior Academic Reasoning Agent. Your goal is to explain concepts clearly, "
            "make comparisons, and analyze academic files based on the provided context.\n"
            "Always align explanations with the educational materials. "
            "Use markdown structure (headings, bullet points, code blocks) to make your response extremely readable. "
            "Cite your sources using [Source 1], [Source 2], etc., matching the provided numbered context items."
        )

        prompt = (
            f"Context material:\n{formatted_context}\n"
            f"User Question: {query}\n\n"
            f"Provide a detailed academic response with inline source citations."
        )

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]

        return llm_service.call_llm(messages)

reasoning_agent = ReasoningAgent()
