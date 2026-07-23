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
    async def tavily_search(self, query: str) -> dict:
        """
        Fallback web search when local vector resources are insufficient (CRAG pipeline).
        """
        default_res = {
            "context": "Web search failed to load relevant results.",
            "results": []
        }
        if not settings.ENABLE_WEB_SEARCH or not settings.TAVILY_API_KEY:
            return {
                "context": "Web search is currently disabled or not configured.",
                "results": []
            }
        
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
                    results = data.get("results", [])
                    
                    # Prepare results with URLs
                    formatted_results = []
                    for r in results:
                        formatted_results.append({
                            "title": r.get("title", "Web Search Source"),
                            "url": r.get("url", ""),
                            "content": r.get("content", "")
                        })
                    
                    if answer:
                        return {
                            "context": answer,
                            "results": formatted_results
                        }
                    # Build from raw results
                    snippets = [r.get("content", "") for r in results[:3]]
                    return {
                        "context": "\n".join(snippets),
                        "results": formatted_results
                    }
        except Exception as e:
            print(f"Tavily web search failed: {e}")
            
        return default_res

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

        # Auto-detect subject if not explicitly specified in filters
        active_filters = dict(filters) if filters else {}
        if "subject" not in active_filters or not active_filters["subject"]:
            detected_subject = retrieval_agent.detect_subject_from_query(scrubbed_query)
            if detected_subject:
                active_filters["subject"] = detected_subject
                print(f"Auto-detected subject: '{detected_subject}' from query: '{scrubbed_query}'")

        # 3. Check answer cache
        cached_res = cache_manager.get_answer(scrubbed_query, active_filters if active_filters else None)
        if cached_res:
            return {**cached_res, "cached": True}

        # 4. Intent Classification via Decision Agent
        classification = decision_agent.classify_intent(scrubbed_query)
        requires_llm = classification.get("requires_llm", False)
        intent_label = classification.get("intent", "factual")

        # 5. Retrieve local chunks matching RBAC permissions
        raw_chunks = retrieval_agent.retrieve_context(
            query=scrubbed_query,
            user_id=user_id,
            role=role,
            limit=5,
            filters=active_filters if active_filters else None
        )

        # Filter chunks to keep only relevant ones (handling mock embeddings and general query fallbacks)
        stop_words = {"what", "is", "a", "the", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with", "who", "where", "how", "why", "which", "this", "that", "these", "those"}
        generic_request_words = {
            "generate", "quiz", "mcq", "viva", "flashcard", "notes", "summary", 
            "syllabus", "exam", "assignment", "explain", "compare", "create", 
            "predict", "revision", "cheat", "roadmap", "why", "how", "what", 
            "difference", "question", "questions", "test", "study", "plan", 
            "document", "file", "slide", "slides", "lecture", "lectures", 
            "chapter", "chapters", "course", "courses", "subject", "subjects", 
            "unit", "units", "topic", "topics", "about", "on", "for", "with", 
            "of", "in", "to", "and", "or", "a", "the", "an", "detail", "details", 
            "definition", "definitions", "give", "me", "show"
        }
        query_words = [w.strip("?,.!") for w in scrubbed_query.lower().split()]
        query_keywords = {w for w in query_words if w and w not in stop_words and w not in generic_request_words}
        if not query_keywords:
            query_keywords = {w for w in query_words if w and w not in stop_words}
        if not query_keywords:
            query_keywords = set(query_words)
            
        retrieved_chunks = []
        for chunk in raw_chunks:
            # High cosine similarity (real embeddings) OR keyword match
            vector_score = chunk.get("score", 0.0)
            chunk_text = chunk.get("text", "").lower()
            is_relevant = (vector_score >= 0.35) or any(word in chunk_text for word in query_keywords)
            if is_relevant:
                retrieved_chunks.append(chunk)

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
                "topic": chunk.get("topic"),
                "url": None
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
                # Fallback to Tavily if no local chunks are available and web search is enabled
                if settings.ENABLE_WEB_SEARCH:
                    search_res = await self.tavily_search(scrubbed_query)
                    web_result = search_res.get("context", "")
                    results = search_res.get("results", [])
                    
                    final_answer = f"### Web Search Fallback Answer\n\n{web_result}\n\n*Note: No matches were found inside the official, personal, or community database. Web search was engaged.*"
                    pipeline_decision = "retrieval_web_fallback"
                    
                    for r_idx, res in enumerate(results[:3]):
                        citations.append({
                            "source_index": r_idx + 1,
                            "document_name": f"Web: {res.get('title', 'Tavily Search')}",
                            "page": 1,
                            "visibility": "web",
                            "subject": "General",
                            "unit": "Search",
                            "topic": "Search Fallback",
                            "url": res.get("url")
                        })
                else:
                    final_answer = "No matching documents were found in the database. Web search fallback is disabled."
                    pipeline_decision = "retrieval_empty"
        else:
            # LLM REASONING PATH
            pipeline_decision = "llm_reasoning"
            
            if retrieved_chunks:
                # Normal Reasoning Synthesis
                final_answer = reasoning_agent.synthesize_answer(scrubbed_query, retrieved_chunks)
                
                # Verify grounding (Verification Agent)
                verification = verification_agent.verify_grounding(final_answer, retrieved_chunks)
                grounding_score = verification.get("grounding_score", 1.0)
                
                # Corrective RAG (CRAG) logic: If grounding confidence is low, pull web search and regenerate (if web search is enabled)
                if grounding_score < 0.6 and settings.ENABLE_WEB_SEARCH:
                    print(f"Grounding score low ({grounding_score}). Running Tavily Web Search...")
                    search_res = await self.tavily_search(scrubbed_query)
                    web_context = search_res.get("context", "")
                    results = search_res.get("results", [])
                    
                    # Merge context and regenerate
                    web_chunk = {
                        "name": "Web Search Fallback",
                        "page_number": 1,
                        "text": web_context
                    }
                    augmented_chunks = retrieved_chunks + [web_chunk]
                    final_answer = reasoning_agent.synthesize_answer(scrubbed_query, augmented_chunks)
                    
                    # Add web search metadata to citations
                    base_idx = len(retrieved_chunks)
                    if results:
                        for r_idx, res in enumerate(results[:3]):
                            citations.append({
                                "source_index": base_idx + r_idx + 1,
                                "document_name": f"Web: {res.get('title', 'Tavily Search')}",
                                "page": 1,
                                "visibility": "web",
                                "subject": "General",
                                "unit": "Search",
                                "topic": "Search Fallback",
                                "url": res.get("url")
                            })
                    else:
                        citations.append({
                            "source_index": base_idx + 1,
                            "document_name": "Web Search (Tavily)",
                            "page": 1,
                            "visibility": "web",
                            "subject": "General",
                            "unit": "Search",
                            "topic": "Search Fallback",
                            "url": None
                        })
                    pipeline_decision = "llm_reasoning_crag"
                    grounding_score = 0.8
                elif grounding_score < 0.6:
                    print(f"Grounding score low ({grounding_score}). Web search is disabled, returning ungrounded local RAG answer.")
            else:
                # Direct Tavily Search and Reasoning without local DB (if web search is enabled)
                if settings.ENABLE_WEB_SEARCH:
                    search_res = await self.tavily_search(scrubbed_query)
                    web_context = search_res.get("context", "")
                    results = search_res.get("results", [])
                    
                    web_chunk = {
                        "name": "Web Search Fallback",
                        "page_number": 1,
                        "text": web_context
                    }
                    final_answer = reasoning_agent.synthesize_answer(scrubbed_query, [web_chunk])
                    
                    if results:
                        for r_idx, res in enumerate(results[:3]):
                            citations.append({
                                "source_index": r_idx + 1,
                                "document_name": f"Web: {res.get('title', 'Tavily Search')}",
                                "page": 1,
                                "visibility": "web",
                                "subject": "General",
                                "unit": "Search",
                                "topic": "Search Fallback",
                                "url": res.get("url")
                            })
                    else:
                        citations.append({
                            "source_index": 1,
                            "document_name": "Web Search (Tavily)",
                            "page": 1,
                            "visibility": "web",
                            "subject": "General",
                            "unit": "Search",
                            "topic": "Search Fallback",
                            "url": None
                        })
                    pipeline_decision = "llm_reasoning_only_web"
                else:
                    final_answer = "I could not find any relevant documents in the academic database to answer your request."
                    pipeline_decision = "llm_reasoning_empty"
 
        # 6. Save payload to answer cache
        payload = {
            "answer": final_answer,
            "decision": pipeline_decision,
            "citations": citations,
            "grounding_score": grounding_score
        }
        cache_manager.set_answer(scrubbed_query, payload, active_filters if active_filters else None)
 
        return payload

orchestrator = AgentOrchestrator()
