import os

from llama_index.core import SimpleDirectoryReader

# Always resolve Data/ relative to the project root (one level up from rag/)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(_PROJECT_ROOT, "Data")


def load_documents():
    if not os.path.isdir(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
        print(f"Created empty Data directory at: {DATA_DIR}")
        return []

    documents = SimpleDirectoryReader(
        input_dir=DATA_DIR,
        recursive=True,
    ).load_data()

    return documents
