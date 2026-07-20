import httpx
from typing import Dict, Any, List, Optional
from app.config import settings
from app.core.security import check_prompt_injection, redact_pii
from app.core.caching import cache_manager
from app.agents.decision_agent import decision_agent
from app.agents.retrieval_agent import retrieval_agent
from app.agents.reasoning_agent import reasoning_agent
from app.agents.verification_agent import verification_agent

class AgentOrchestrator:
    async def tavily_search(self, query: str) -> str:
        """
        Fallback web search when local vector resources are insufficient (CRAG pipeline).
        """
        if not settings.TAVILY_API_KEY:
            return "Web search is currently offline (TAVILY_API_KEY not configured)."
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.TAVILY_API_KEY,
                        "query": query,
                        "search_depth": "basic",
                        "include_answer": True
                    },
                    timeout=8.0
                )
                if response.status_code == 200:
                    data = response.json()
                    answer = data.get("answer")
                    if answer:
                        return answer
                    # Build from raw results
                    results = data.get("results", [])
                    snippets = [r.get("content", "") for r in results[:3]]
                    return "\n".join(snippets)
        except Exception as e:
            print(f"Tavily web search failed: {e}")
            
        return "Web search failed to load relevant results."

    async def execute_query(
        self,
        query: str,
        user_id: int,
        role: str,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Orchestrates the entire query pipeline:
        Security checks -> Intent -> Retrieval -> Decision Routing -> Verification -> Self-RAG/Tavily fallback.
        """
        # 1. Security pipeline: prompt injection check
        if check_prompt_injection(query):
            return {
                "answer": "Security Alert: Prompt injection attempt detected. Request blocked.",
                "decision": "blocked",
                "citations": [],
                "grounding_score": 0.0,
                "warnings": ["Prompt injection indicator flagged."]
            }

        # 2. Security pipeline: PII redaction
        scrubbed_query = redact_pii(query)

        # 3. Check answer cache
        cached_res = cache_manager.get_answer(scrubbed_query, filters)
        if cached_res:
            return {**cached_res, "cached": True}

        # 4. Intent Classification via Decision Agent
        classification = decision_agent.classify_intent(scrubbed_query)
        requires_llm = classification.get("requires_llm", False)
        intent_label = classification.get("intent", "factual")

        # 5. Retrieve local chunks matching RBAC permissions
        retrieved_chunks = retrieval_agent.retrieve_context(
            query=scrubbed_query,
            user_id=user_id,
            role=role,
            limit=5,
            filters=filters
        )

        final_answer = ""
        citations = []
        pipeline_decision = ""
        grounding_score = 1.0

        # Form citations list
        for idx, chunk in enumerate(retrieved_chunks):
            citations.append({
                "source_index": idx + 1,
                "document_name": chunk.get("name", "Document"),
                "page": chunk.get("page_number", "?"),
                "visibility": chunk.get("visibility"),
                "subject": chunk.get("subject"),
                "unit": chunk.get("unit"),
                "topic": chunk.get("topic")
            })

        # --- ROUTING DECISION ENGINE ---
        if not requires_llm:
            # RETRIEVAL-ONLY PATH (LLM is NOT engaged)
            pipeline_decision = "retrieval_only"
            
            if retrieved_chunks:
                # Direct return of retrieved contents
                # Select the top 1 or 2 highest-ranking chunks and combine them directly
                compiled_text = "\n\n".join([
                    f"### Retrieved Content (Source [{i+1}]): {chunk.get('name')} (Page {chunk.get('page_number')})\n{chunk.get('text')}"
                    for i, chunk in enumerate(retrieved_chunks[:2])
                ])
                final_answer = compiled_text
            else:
                # Fallback to Tavily if no local chunks are available
                web_result = await self.tavily_search(scrubbed_query)
                final_answer = f"### Web Search Fallback Answer\n\n{web_result}\n\n*Note: No matches were found inside the official, personal, or community database. Web search was engaged.*"
                pipeline_decision = "retrieval_web_fallback"
        else:
            # LLM REASONING PATH
            pipeline_decision = "llm_reasoning"
            
            if retrieved_chunks:
                # Normal Reasoning Synthesis
                final_answer = reasoning_agent.synthesize_answer(scrubbed_query, retrieved_chunks)
                
                # Verify grounding (Verification Agent)
                verification = verification_agent.verify_grounding(final_answer, retrieved_chunks)
                grounding_score = verification.get("grounding_score", 1.0)
                
                # Corrective RAG (CRAG) logic: If grounding confidence is low, pull web search and regenerate
                if grounding_score < 0.6:
                    print(f"Grounding score low ({grounding_score}). Running Tavily Web Search...")
                    web_context = await self.tavily_search(scrubbed_query)
                    
                    # Merge context and regenerate
                    web_chunk = {
                        "name": "Web Search Fallback",
                        "page_number": 1,
                        "text": web_context
                    }
                    augmented_chunks = retrieved_chunks + [web_chunk]
                    final_answer = reasoning_agent.synthesize_answer(scrubbed_query, augmented_chunks)
                    
                    # Add web search metadata to citations
                    citations.append({
                        "source_index": len(augmented_chunks),
                        "document_name": "Web Search (Tavily)",
                        "page": 1,
                        "visibility": "web",
                        "subject": "General",
                        "unit": "Search",
                        "topic": "Search Fallback"
                    })
                    pipeline_decision = "llm_reasoning_crag"
                    grounding_score = 0.8
            else:
                # Direct Tavily Search and Reasoning without local DB
                web_context = await self.tavily_search(scrubbed_query)
                web_chunk = {
                    "name": "Web Search Fallback",
                    "page_number": 1,
                    "text": web_context
                }
                final_answer = reasoning_agent.synthesize_answer(scrubbed_query, [web_chunk])
                citations.append({
                    "source_index": 1,
                    "document_name": "Web Search (Tavily)",
                    "page": 1,
                    "visibility": "web",
                    "subject": "General",
                    "unit": "Search",
                    "topic": "Search Fallback"
                })
                pipeline_decision = "llm_reasoning_only_web"

        # 6. Save payload to answer cache
        payload = {
            "answer": final_answer,
            "decision": pipeline_decision,
            "citations": citations,
            "grounding_score": grounding_score
        }
        cache_manager.set_answer(scrubbed_query, payload, filters)

        return payload

orchestrator = AgentOrchestrator()
