from dotenv import load_dotenv
load_dotenv()

from llama_index.core import VectorStoreIndex

from load_documents import load_documents
from embedding_model import embed_model
from vector_store import storage_context


print("Loading documents...")
documents = load_documents()

print("Building index...")

index = VectorStoreIndex.from_documents(
    documents,
    embed_model=embed_model,
    storage_context=storage_context,
    show_progress=True
)

print("Index created successfully!")