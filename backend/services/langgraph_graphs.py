"""
LangGraph workflow graphs for JurisAI chat modes.

Graph types:
  - MAIN          : Global RAG over all documents (no filter)
  - BNS/BNSS/BSA/CNT/IT : Source-filtered RAG — filter = {'source': mode}
  - CASE          : ReAct tool-calling agent with 8 tools scoped to a case:
                    fetch_case_info, search_case_docs, search_all_laws,
                    search_bns, search_bnss, search_bsa, search_constitution,
                    search_it_act

Each graph uses AsyncPostgresSaver (langgraph-checkpoint-postgres) for
full persistent conversation memory keyed by thread_id.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Annotated, Any, AsyncIterator, Literal

from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from typing_extensions import TypedDict

load_dotenv()


from rag.query_engine import llm, get_retriever, _bedrock_embeddings

_ASYNC_DB_URL = os.getenv("ASYNC_DATABASE_URL", "")

_LG_DB_URL = _ASYNC_DB_URL.replace(
    "postgresql+asyncpg://", "postgresql://"
).replace("?ssl=require", "?sslmode=require")

_checkpointer: AsyncPostgresSaver | None = None
_pool = None  # psycopg_pool.AsyncConnectionPool
_checkpointer_lock = asyncio.Lock()


async def get_checkpointer() -> AsyncPostgresSaver:
    """Return (and lazily initialise) the shared AsyncPostgresSaver.

    Uses AsyncConnectionPool so the saver survives the full process
    lifetime without needing a context-manager wrapper.

    reconnect_timeout=30  — try to reconnect for up to 30 s if the pool
    runs out of healthy connections (handles transient SSL drops from Neon).
    check=AsyncConnectionPool.check_connection — validates each connection
    before handing it out, so stale SSL connections are discarded promptly.
    """
    global _checkpointer, _pool
    async with _checkpointer_lock:
        if _checkpointer is None:
            from psycopg_pool import AsyncConnectionPool

            _pool = AsyncConnectionPool(
                conninfo=_LG_DB_URL,
                max_size=20,
                kwargs={"autocommit": True, "prepare_threshold": 0},
                reconnect_timeout=30,
                open=False,
            )
            await _pool.open()
            _checkpointer = AsyncPostgresSaver(_pool)
            await _checkpointer.setup()   # creates checkpoint tables in DB
    return _checkpointer


class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
    query: str
    context_docs: list[dict]
    final_answer: str
    citations: list[dict]
    mode: str
    case_id: str | None


# ---------------------------------------------------------------------------
# Shared node helpers
# ---------------------------------------------------------------------------

def _extract_citations(docs) -> list[dict]:
    seen: set = set()
    citations: list[dict] = []
    for doc in docs:
        src = doc.metadata.get("source") or doc.metadata.get("file_name", "Unknown")
        key = src + doc.page_content[:40]
        if key not in seen:
            seen.add(key)
            citations.append({
                "file_name": src,
                "snippet": doc.page_content[:350],
            })
    return citations


def _build_context(docs) -> str:
    return "\n\n---\n\n".join(d.page_content for d in docs)


# Valid modes with no filter (global search)
_MAIN_MODES = {"MAIN"}
# Modes that filter by source metadata
_SOURCE_FILTERED_MODES = {"BNS", "BNSS", "BSA", "CNT", "IT"}

# Human-readable labels for system prompts
_MODE_LABELS = {
    "MAIN": "all uploaded legal documents",
    "BNS":  "Bharatiya Nyaya Sanhita (BNS)",
    "BNSS": "Bharatiya Nagarik Suraksha Sanhita (BNSS)",
    "BSA":  "Bharatiya Sakshya Adhiniyam (BSA)",
    "CNT":  "Constitution of India",
    "IT":   "Information Technology Act",
    "CASE": "a specific legal case with all relevant laws",
}


def _make_main_graph():
    """
    MAIN graph — global RAG, no source filter.
      retrieve -> generate -> END
    """

    async def retrieve_node(state: ChatState) -> dict:
        retriever = await get_retriever({"k": 5})
        docs = await retriever.ainvoke(state["query"])
        return {
            "context_docs": _extract_citations(docs),
            "messages": [],
        }

    async def generate_node(state: ChatState) -> dict:
        context = "\n\n".join(
            d["snippet"] for d in state.get("context_docs", [])
        )
        system = (
            "You are JurisAI, an expert Indian legal research assistant. "
            "Answer based on the following context from legal documents. "
            "Be precise, cite relevant sections, and if you don't know say so.\n\n"
            f"Context:\n{context}"
        )
        history = state["messages"]
        msgs = [SystemMessage(content=system)] + list(history)

        response = await llm.ainvoke(msgs)
        ai_msg = AIMessage(content=response.content)
        return {
            "final_answer": response.content,
            "citations": state.get("context_docs", []),
            "messages": [ai_msg],
        }

    g = StateGraph(ChatState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("generate", generate_node)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "generate")
    g.add_edge("generate", END)
    return g


def _make_source_filtered_graph(mode: str):
    """
    Source-filtered graph for BNS / BNSS / BSA / CNT / IT.
    Filters vector DB by metadata filter = {'source': mode}.
      retrieve -> generate -> END
    """
    source_label = _MODE_LABELS.get(mode, mode)

    async def retrieve_node(state: ChatState) -> dict:
        search_kwargs = {
            "k": 5,
            "filter": {"source": mode},
        }
        retriever = await get_retriever(search_kwargs)
        docs = await retriever.ainvoke(state["query"])
        return {"context_docs": _extract_citations(docs), "messages": []}

    async def generate_node(state: ChatState) -> dict:
        context = "\n\n".join(
            d["snippet"] for d in state.get("context_docs", [])
        )
        system = (
            f"You are JurisAI, an expert Indian legal AI assistant specialised in {source_label}. "
            f"Answer questions using only the {source_label} documents retrieved below. "
            "Be precise, cite relevant sections or articles, and if you don't know say so.\n\n"
            f"Context from {source_label}:\n{context}"
        )
        history = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
        msgs = [SystemMessage(content=system)] + history

        response = await llm.ainvoke(msgs)
        ai_msg = AIMessage(content=response.content)
        return {
            "final_answer": response.content,
            "citations": state.get("context_docs", []),
            "messages": [ai_msg],
        }

    g = StateGraph(ChatState)
    g.add_node("retrieve", retrieve_node)
    g.add_node("generate", generate_node)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "generate")
    g.add_edge("generate", END)
    return g


# ---------------------------------------------------------------------------
# CASE mode — ReAct tool-calling agent
# ---------------------------------------------------------------------------

def _make_case_tools(case_id: str, user_id: str | None = None):
    """
    Build the 8 tools for the CASE agent.
    Tools are normal sync/async callables wrapped with @tool.
    case_id is captured via closure.
    """

    @tool
    async def fetch_case_info(query: str = "") -> str:
        """
        Fetch structured metadata for the current case from the database.
        Returns title, court, status, petitioner, respondent, acts involved,
        filing date, hearing date, advocate, and linked client name.
        Use this first to understand the case context before searching documents.
        """
        try:
            from backend.services.case_service import get_case
            # We don't have user_id in the closure (it's per-request), so we do a
            # broader lookup via raw SQL — the case_id is enough since it's unique.
            from backend.db.database import get_conn, row_to_dict
            with get_conn() as conn:
                cur = conn.cursor()
                cur.execute(
                    """SELECT c.*, cl.name AS client_name, cl.phone AS client_phone,
                              cl.email AS client_email
                       FROM cases c
                       LEFT JOIN clients cl ON c.client_id = cl.id
                       WHERE c.id = %s""",
                    (case_id,),
                )
                row = cur.fetchone()
                cur.close()
            if not row:
                return f"Case with id '{case_id}' not found."
            c = row_to_dict(row)
            lines = [
                f"**Case Title:** {c.get('title', '—')}",
                f"**Case Number:** {c.get('case_number', '—')}",
                f"**Court:** {c.get('court', '—')}",
                f"**Status:** {c.get('status', '—')}",
                f"**Case Type:** {c.get('case_type', '—')}",
                f"**Petitioner:** {c.get('petitioner', '—')}",
                f"**Respondent:** {c.get('respondent', '—')}",
                f"**Judge(s):** {c.get('judges', '—')}",
                f"**Filing Date:** {c.get('filing_date', '—')}",
                f"**Judgment Date:** {c.get('judgment_date', '—')}",
                f"**Next Hearing:** {c.get('hearing_date', '—')}",
                f"**Advocate:** {c.get('advocate', '—')}",
                f"**Acts Involved:** {c.get('acts_involved', '—')}",
                f"**Constitutional Articles:** {c.get('constitutional_articles', '—')}",
                f"**Client:** {c.get('client_name', '—')} ({c.get('client_email', '—')})",
            ]
            return "\n".join(lines)
        except Exception as exc:
            return f"Error fetching case info: {exc}"

    @tool
    async def search_case_docs(query: str) -> str:
        """
        Semantic search over documents uploaded specifically for this case.
        Use this to find relevant excerpts from the case's own documents
        (charge sheets, petitions, judgments, evidence, etc.).
        """
        try:
            retriever = await get_retriever({
                "k": 6,
                "filter": {"case_id": case_id},
            })
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching documents found for this case."
            parts = []
            for i, d in enumerate(docs, 1):
                src = d.metadata.get("source") or d.metadata.get("file_name", "doc")
                parts.append(f"[{i}] **{src}**\n{d.page_content[:500]}")
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching case documents: {exc}"

    @tool
    async def search_all_laws(query: str) -> str:
        """
        Semantic search across ALL uploaded legal documents (no source filter).
        Use this for broad legal research not tied to a specific statute.
        """
        try:
            retriever = await get_retriever({"k": 5})
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching documents found."
            parts = []
            for i, d in enumerate(docs, 1):
                src = d.metadata.get("source") or d.metadata.get("file_name", "doc")
                parts.append(f"[{i}] **{src}**\n{d.page_content[:500]}")
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching all laws: {exc}"

    @tool
    async def search_bns(query: str) -> str:
        """
        Search the Bharatiya Nyaya Sanhita (BNS) — India's new criminal code
        that replaces the Indian Penal Code (IPC).
        Use for questions about offences, punishments, criminal liability.
        """
        try:
            retriever = await get_retriever({"k": 5, "filter": {"source": "BNS"}})
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching sections found in BNS."
            parts = [f"[{i}] {d.page_content[:500]}" for i, d in enumerate(docs, 1)]
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching BNS: {exc}"

    @tool
    async def search_bnss(query: str) -> str:
        """
        Search the Bharatiya Nagarik Suraksha Sanhita (BNSS) — India's new
        code of criminal procedure replacing the CrPC.
        Use for questions about investigation, trial, bail, appeals procedure.
        """
        try:
            retriever = await get_retriever({"k": 5, "filter": {"source": "BNSS"}})
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching sections found in BNSS."
            parts = [f"[{i}] {d.page_content[:500]}" for i, d in enumerate(docs, 1)]
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching BNSS: {exc}"

    @tool
    async def search_bsa(query: str) -> str:
        """
        Search the Bharatiya Sakshya Adhiniyam (BSA) — India's new evidence law
        replacing the Indian Evidence Act.
        Use for questions about admissibility of evidence, witness testimony, digital evidence.
        """
        try:
            retriever = await get_retriever({"k": 5, "filter": {"source": "BSA"}})
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching sections found in BSA."
            parts = [f"[{i}] {d.page_content[:500]}" for i, d in enumerate(docs, 1)]
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching BSA: {exc}"

    @tool
    async def search_constitution(query: str) -> str:
        """
        Search the Constitution of India.
        Use for fundamental rights, directive principles, constitutional provisions,
        Articles, constitutional amendments.
        """
        try:
            retriever = await get_retriever({"k": 5, "filter": {"source": "CNT"}})
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching articles found in the Constitution."
            parts = [f"[{i}] {d.page_content[:500]}" for i, d in enumerate(docs, 1)]
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching Constitution: {exc}"

    @tool
    async def search_it_act(query: str) -> str:
        """
        Search the Information Technology Act (IT Act).
        Use for questions about cyber crimes, digital signatures, electronic evidence,
        data protection, online offences.
        """
        try:
            retriever = await get_retriever({"k": 5, "filter": {"source": "IT"}})
            docs = await retriever.ainvoke(query)
            if not docs:
                return "No matching sections found in the IT Act."
            parts = [f"[{i}] {d.page_content[:500]}" for i, d in enumerate(docs, 1)]
            return "\n\n---\n\n".join(parts)
        except Exception as exc:
            return f"Error searching IT Act: {exc}"

    return [
        fetch_case_info,
        search_case_docs,
        search_all_laws,
        search_bns,
        search_bnss,
        search_bsa,
        search_constitution,
        search_it_act,
    ]


def _make_case_agent_graph(case_id: str):
    """
    CASE mode — ReAct tool-calling agent.

    Graph:
        agent_node  ->  tools_condition  ->  tool_node  ->  agent_node  -> ...
                                         ->  END  (if no tool call)
    """
    tools = _make_case_tools(case_id)
    llm_with_tools = llm.bind_tools(tools)

    system_prompt = (
        "You are JurisAI, an expert Indian legal AI assistant working on a specific legal case.\n"
        "You have access to a set of tools to research this case:\n"
        "  • fetch_case_info — retrieves the case's structured metadata from the database\n"
        "  • search_case_docs — searches documents uploaded for this specific case\n"
        "  • search_all_laws — searches all legal documents (broad research)\n"
        "  • search_bns — Bharatiya Nyaya Sanhita (criminal code)\n"
        "  • search_bnss — Bharatiya Nagarik Suraksha Sanhita (criminal procedure)\n"
        "  • search_bsa — Bharatiya Sakshya Adhiniyam (evidence law)\n"
        "  • search_constitution — Constitution of India\n"
        "  • search_it_act — Information Technology Act\n\n"
        "Always start by calling fetch_case_info if you need case context.\n"
        "Then use the appropriate search tools to gather relevant legal provisions.\n"
        "Synthesise your findings into a precise, well-reasoned legal answer.\n"
        "Cite the specific sections, articles, or document excerpts you relied upon."
    )

    async def agent_node(state: ChatState) -> dict:
        history = [m for m in state["messages"] if not isinstance(m, SystemMessage)]
        msgs = [SystemMessage(content=system_prompt)] + history
        response = await llm_with_tools.ainvoke(msgs)
        return {"messages": [response]}

    tool_node = ToolNode(tools)

    g = StateGraph(ChatState)
    g.add_node("agent", agent_node)
    g.add_node("tools", tool_node)
    g.set_entry_point("agent")
    g.add_conditional_edges("agent", tools_condition)
    g.add_edge("tools", "agent")
    return g


# ---------------------------------------------------------------------------
# Graph compilation cache
# ---------------------------------------------------------------------------

_compiled_graphs: dict[str, Any] = {}
_graph_lock = asyncio.Lock()


async def get_compiled_graph(
    mode: str,
    case_id: str | None = None,
    case_context: str = "",
) -> Any:
    """
    Return a compiled (checkpointed) LangGraph for the given mode.
    Graphs are cached by (mode, case_id) key.

    MAIN  -> global RAG, no filter
    BNS/BNSS/BSA/CNT/IT -> source-filtered RAG
    CASE  -> ReAct tool-calling agent (cached per case_id)
    """
    # CASE graphs are per-case so include case_id in cache key
    cache_key = f"{mode}:{case_id}" if mode == "CASE" else mode

    async with _graph_lock:
        if cache_key not in _compiled_graphs:
            checkpointer = await get_checkpointer()

            if mode == "MAIN":
                graph_def = _make_main_graph()
            elif mode in _SOURCE_FILTERED_MODES:
                graph_def = _make_source_filtered_graph(mode)
            elif mode == "CASE":
                if not case_id:
                    raise ValueError("CASE mode requires a case_id")
                graph_def = _make_case_agent_graph(case_id)
            else:
                raise ValueError(f"Unknown chat mode: {mode!r}")

            compiled = graph_def.compile(checkpointer=checkpointer)
            _compiled_graphs[cache_key] = compiled

    return _compiled_graphs[cache_key]


# ---------------------------------------------------------------------------
# Public runner — used by chat_service
# ---------------------------------------------------------------------------

async def run_graph_streaming(
    thread_id: str,
    mode: str,
    query: str,
    case_id: str | None = None,
    case_context: str = "",
) -> AsyncIterator[dict]:
    """
    Stream events from the LangGraph graph for the given thread.

    Yields dicts:
      {"type": "chunk",  "content": "..."}
      {"type": "done",   "citations": [...], "final_answer": "..."}
      {"type": "error",  "content": "..."}
    """
    graph = await get_compiled_graph(mode, case_id, case_context)
    config = {"configurable": {"thread_id": thread_id}}

    input_state: ChatState = {
        "messages": [HumanMessage(content=query)],
        "query": query,
        "context_docs": [],
        "final_answer": "",
        "citations": [],
        "mode": mode,
        "case_id": case_id,
    }

    final_answer = ""
    citations: list[dict] = []

    try:
        async for event in graph.astream(input_state, config=config, stream_mode="updates"):
            # Each event is {node_name: updated_state_slice}
            for node_name, node_output in event.items():
                if node_name == "generate":
                    # RAG modes (MAIN / source-filtered)
                    answer = node_output.get("final_answer", "")
                    if answer and answer != final_answer:
                        delta = answer[len(final_answer):]
                        if delta:
                            yield {"type": "chunk", "content": delta}
                        final_answer = answer
                        citations = node_output.get("citations", citations)

                elif node_name == "agent":
                    # CASE agent mode — extract content from AIMessage
                    msgs = node_output.get("messages", [])
                    for msg in msgs:
                        if isinstance(msg, AIMessage) and msg.content:
                            # Only yield text content (skip pure tool-call messages)
                            content = msg.content
                            if isinstance(content, list):
                                # Content may be a list of blocks (tool_use + text)
                                text_parts = [
                                    b.get("text", "") if isinstance(b, dict) else str(b)
                                    for b in content
                                    if not (isinstance(b, dict) and b.get("type") == "tool_use")
                                ]
                                content = "".join(text_parts)
                            if content and content != final_answer:
                                delta = content[len(final_answer):]
                                if delta:
                                    yield {"type": "chunk", "content": delta}
                                final_answer = content

                elif node_name == "tools":
                    # Collect citations from tool outputs (search_* tools)
                    msgs = node_output.get("messages", [])
                    for msg in msgs:
                        if isinstance(msg, ToolMessage):
                            name = getattr(msg, "name", "") or ""
                            if name.startswith("search_"):
                                # Parse tool output into citation snippets
                                raw = msg.content or ""
                                if raw and raw != "No matching" and "not found" not in raw.lower():
                                    citations.append({
                                        "file_name": f"[{name}]",
                                        "snippet": raw[:350],
                                    })

        yield {"type": "done", "citations": citations, "final_answer": final_answer}

    except Exception as exc:
        yield {"type": "error", "content": str(exc)}


async def get_thread_history(thread_id: str, mode: str, case_id: str | None = None) -> list[dict]:
    """
    Read persisted conversation history from the LangGraph checkpointer.
    Returns a list of {role, content, ...} dicts.
    Returns [] on any connection error — the caller (routes.py) falls back to
    the chat_messages DB table in that case.
    """
    import logging
    _log = logging.getLogger(__name__)
    try:
        graph = await get_compiled_graph(mode, case_id)
        config = {"configurable": {"thread_id": thread_id}}
        state = await graph.aget_state(config)
    except Exception as exc:
        _log.warning("get_thread_history: checkpointer unavailable (%s), using DB fallback", exc)
        return []

    if not state or not state.values:
        return []

    messages = state.values.get("messages", [])
    history = []
    for msg in messages:
        if isinstance(msg, HumanMessage):
            history.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            # Extract text content (skip tool-call blocks)
            content = msg.content
            if isinstance(content, list):
                text_parts = [
                    b.get("text", "") if isinstance(b, dict) else str(b)
                    for b in content
                    if not (isinstance(b, dict) and b.get("type") == "tool_use")
                ]
                content = "".join(text_parts).strip()
            if content:
                history.append({"role": "assistant", "content": content})
        # Skip SystemMessage / ToolMessage (internal)
    return history
