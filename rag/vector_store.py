import chromadb

from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.core import StorageContext


chroma_client = chromadb.PersistentClient(
    path="Data/Processed/chroma_db"
)

chroma_collection = chroma_client.get_or_create_collection(
    name="jurisai_legal_docs"
)

vector_store = ChromaVectorStore(
    chroma_collection=chroma_collection
)

storage_context = StorageContext.from_defaults(
    vector_store=vector_store
)