from llama_index.core import SimpleDirectoryReader


def load_documents():
    documents = SimpleDirectoryReader(
        input_dir="Data",
        recursive=True
    ).load_data()

    return documents


if __name__ == "__main__":
    docs = load_documents()

    print(f"Loaded {len(docs)} documents")

    print(docs[0].text[:1000])
    
    