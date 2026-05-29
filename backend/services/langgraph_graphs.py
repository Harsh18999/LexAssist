"""
LangGraph workflow graphs for JurisAI chat modes.

Two graph types:
  - MAIN          : Global RAG over all documents (no filter)
  - BNS/BNSS/BSA/CNT/IT : Source-filtered RAG — filter = {'source': mode}

Each graph uses AsyncPostgresSaver (langgraph-checkpoint-postgres) for
full persistent conversation memory keyed by thread_id.
"""

from __future__ import annotations

import asyncio
import os
from typing import Annotated, Any, AsyncIterator

from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
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




_compiled_graphs: dict[str, Any] = {}
_graph_lock = asyncio.Lock()


async def get_compiled_graph(
    mode: str,
    case_id: str | None = None,
    case_context: str = "",
) -> Any:
    """
    Return a compiled (checkpointed) LangGraph for the given mode.
    Graphs are cached by mode key.

    MAIN  -> global RAG, no filter
    BNS/BNSS/BSA/CNT/IT -> source-filtered RAG
    """
    cache_key = mode  # all source-filtered graphs are mode-specific

    async with _graph_lock:
        if cache_key not in _compiled_graphs:
            checkpointer = await get_checkpointer()

            if mode == "MAIN":
                graph_def = _make_main_graph()
            elif mode in _SOURCE_FILTERED_MODES:
                graph_def = _make_source_filtered_graph(mode)
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
                    answer = node_output.get("final_answer", "")
                    if answer and answer != final_answer:
                        # Emit new content as a single chunk (LangGraph doesn't
                        # token-stream natively; we emit the full delta per node)
                        delta = answer[len(final_answer):]
                        if delta:
                            yield {"type": "chunk", "content": delta}
                        final_answer = answer
                        citations = node_output.get("citations", citations)

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
            history.append({"role": "assistant", "content": msg.content})
        # Skip SystemMessage (internal)
    return history
