import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

from langchain_aws import ChatBedrockConverse, BedrockEmbeddings
from langchain_postgres import PGEngine, PGVectorStore
from langchain_classic.chains import RetrievalQA
from langchain_core.prompts import PromptTemplate

# ---------------------------------------------------------------------------
# Bedrock LLM (streaming via Converse API)
# ChatBedrockConverse uses the unified Bedrock Converse API which correctly
# serialises the `messages` array for all models including DeepSeek.
# ---------------------------------------------------------------------------

llm = ChatBedrockConverse(
    model="openai.gpt-oss-safeguard-120b",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
    streaming=True,
)

print("LOADED MODEL: openai.gpt-oss-safeguard-120b (AWS Bedrock Converse API)")

# ---------------------------------------------------------------------------
# Bedrock Embeddings
# ---------------------------------------------------------------------------

_bedrock_embeddings = BedrockEmbeddings(
    model_id="amazon.titan-embed-text-v2:0",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
)

print("LOADED EMBEDDINGS: amazon.titan-embed-text-v2:0 (AWS Bedrock)")

# ---------------------------------------------------------------------------
# PGEngine + PGVectorStore (langchain-postgres)
# ---------------------------------------------------------------------------

ASYNC_DATABASE_URL = os.getenv("ASYNC_DATABASE_URL")
TABLE_NAME = "LEGAL_VECTOR_DB"

pg_engine = PGEngine.from_connection_string(url=ASYNC_DATABASE_URL)


async def _build_store() -> PGVectorStore:
    return await PGVectorStore.create(
        engine=pg_engine,
        table_name=TABLE_NAME,
        embedding_service=_bedrock_embeddings,
    )


# Lazy singleton — created once on first use (async-safe)
_store: PGVectorStore | None = None
_store_lock = asyncio.Lock()


async def _get_store() -> PGVectorStore:
    global _store
    async with _store_lock:
        if _store is None:
            _store = await _build_store()
    return _store


# ---------------------------------------------------------------------------
# Retriever (top-5 similar chunks)
# ---------------------------------------------------------------------------

async def get_retriever(search_kwargs: dict = None):
    store = await _get_store()
    return store.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs or {"k": 5},
    )


async def get_doc_retriever(search_kwargs: dict = None):
    """Return a retriever backed by DOCUMENT_VECTOR_DB (case-uploaded docs)."""
    from rag.vector_store import aget_doc_store
    store = await aget_doc_store()
    return store.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs or {"k": 5},
    )


# ---------------------------------------------------------------------------
# RAG chain
# ---------------------------------------------------------------------------

_RAG_PROMPT = PromptTemplate.from_template(
    "You are a legal AI assistant. Use the following context from Indian legal documents "
    "to answer the question. If you don't know, say so.\n\n"
    "Context:\n{context}\n\n"
    "Question: {question}\n\n"
    "Answer:"
)


def build_rag_chain(retriever=None):
    """Build a RetrievalQA chain with the given retriever (or the default one)."""
    return RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=retriever or get_retriever(),
        return_source_documents=True,
        chain_type_kwargs={"prompt": _RAG_PROMPT},
    )


# Default chain instance (created lazily on first query)
_rag_chain: RetrievalQA | None = None


def get_rag_chain() -> RetrievalQA:
    global _rag_chain
    if _rag_chain is None:
        _rag_chain = build_rag_chain()
    return _rag_chain