import os

from dotenv import load_dotenv
load_dotenv()

import chromadb

from llama_index.core import VectorStoreIndex
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import StorageContext
from llama_index.llms.openai import OpenAI



# -----------------------------
# Embedding Model
# -----------------------------

embed_model = HuggingFaceEmbedding(
    model_name="BAAI/bge-small-en-v1.5"
)


# -----------------------------
# Hugging Face LLM
# -----------------------------

from llama_index.llms.openai import OpenAI

from llama_index.llms.openai import OpenAI

llm = OpenAI(
    model="gpt-3.5-turbo",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    api_base="https://openrouter.ai/api/v1",
)


# -----------------------------
# ChromaDB Setup
# -----------------------------

client = chromadb.PersistentClient(
    path="Data/Processed/chroma_db"
)

collection = client.get_or_create_collection(
    name="jurisai_legal_docs"
)

vector_store = ChromaVectorStore(
    chroma_collection=collection
)

storage_context = StorageContext.from_defaults(
    vector_store=vector_store
)


# -----------------------------
# Load Existing Vector Index
# -----------------------------

index = VectorStoreIndex.from_vector_store(
    vector_store=vector_store,
    embed_model=embed_model
)


# -----------------------------
# Create Query Engine
# -----------------------------

query_engine = index.as_query_engine(
    llm=llm,
    similarity_top_k=5,
    response_mode="compact"
)