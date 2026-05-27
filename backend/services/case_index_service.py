import os

import chromadb
from llama_index.core import Document, VectorStoreIndex
from llama_index.core import StorageContext
from llama_index.vector_stores.chroma import ChromaVectorStore

from rag.embedding_model import embed_model

CHROMA_PATH = "Data/Processed/chroma_db"
COLLECTION = "jurisai_legal_docs"


def _get_collection():
    client = chromadb.PersistentClient(path=CHROMA_PATH)
    return client.get_or_create_collection(name=COLLECTION)


def index_case_document(user_id: str, case_id: str, file_path: str, filename: str):
    """Add case document chunks to vector store with case metadata."""
    try:
        import fitz
    except ImportError:
        return

    if not os.path.isfile(file_path):
        return

    doc = fitz.open(file_path)
    text = ""
    for i in range(min(20, len(doc))):
        text += doc[i].get_text() + "\n"
    doc.close()
    if not text.strip():
        return

    collection = _get_collection()
    vector_store = ChromaVectorStore(chroma_collection=collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    document = Document(
        text=text[:12000],
        metadata={
            "file_name": filename,
            "user_id": user_id,
            "case_id": case_id,
            "scope": "case",
        },
    )
    VectorStoreIndex.from_documents(
        [document],
        embed_model=embed_model,
        storage_context=storage_context,
    )
