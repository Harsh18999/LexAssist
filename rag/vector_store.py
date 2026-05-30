import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

from langchain_postgres import PGEngine, PGVectorStore
from langchain_aws import BedrockEmbeddings

# ---------------------------------------------------------------------------
# Shared config
# ---------------------------------------------------------------------------

ASYNC_DATABASE_URL = os.getenv("ASYNC_DATABASE_URL")

# Statute law corpus (BNS, BNSS, BSA, CNT, IT)
TABLE_NAME = "LEGAL_VECTOR_DB"

# Case-uploaded document embeddings (filterable by document_id + case_id)
DOC_TABLE_NAME = "DOCUMENT_VECTOR_DB"

VECTOR_SIZE = 1024  # Titan Embed v2 1024-dim output

# ---------------------------------------------------------------------------
# Bedrock Embeddings (used directly — no LlamaIndex wrapper needed here)
# ---------------------------------------------------------------------------

_bedrock_embeddings = BedrockEmbeddings(
    model_id="amazon.titan-embed-text-v2:0",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
)

# ---------------------------------------------------------------------------
# PGEngine (async, shared singleton)
# ---------------------------------------------------------------------------

pg_engine = PGEngine.from_connection_string(url=ASYNC_DATABASE_URL)


# ---------------------------------------------------------------------------
# Helpers: init tables + get stores
# ---------------------------------------------------------------------------

async def ainit_table() -> None:
    """Create the LEGAL_VECTOR_DB vector table in Postgres if it does not exist."""
    await pg_engine.ainit_vectorstore_table(
        table_name=TABLE_NAME,
        vector_size=VECTOR_SIZE,
        overwrite=False,  # safe to call repeatedly
    )


async def ainit_doc_table() -> None:
    """Create the DOCUMENT_VECTOR_DB vector table in Postgres if it does not exist."""
    await pg_engine.ainit_vectorstore_table(
        table_name=DOC_TABLE_NAME,
        vector_size=VECTOR_SIZE,
        overwrite=False,  # safe to call repeatedly
    )


async def aget_store() -> PGVectorStore:
    """Return a ready-to-use PGVectorStore for LEGAL_VECTOR_DB (statute law)."""
    return await PGVectorStore.create(
        engine=pg_engine,
        table_name=TABLE_NAME,
        embedding_service=_bedrock_embeddings,
    )


async def aget_doc_store() -> PGVectorStore:
    """Return a ready-to-use PGVectorStore for DOCUMENT_VECTOR_DB (case documents)."""
    return await PGVectorStore.create(
        engine=pg_engine,
        table_name=DOC_TABLE_NAME,
        embedding_service=_bedrock_embeddings,
    )


def get_store() -> PGVectorStore:
    """Sync convenience wrapper — safe to call from outside an event loop only.
    
    WARNING: Do NOT call from within an async context / FastAPI route.
    Use `await aget_store()` instead.
    """
    import threading

    result = None
    exc_holder = []

    def _run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result_holder.append(loop.run_until_complete(aget_store()))
        except Exception as e:
            exc_holder.append(e)
        finally:
            loop.close()

    result_holder = []
    t = threading.Thread(target=_run)
    t.start()
    t.join()
    if exc_holder:
        raise exc_holder[0]
    return result_holder[0]