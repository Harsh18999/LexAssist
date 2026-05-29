import os
import sys
import asyncio
import uuid

# Ensure project root is on sys.path
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))

import fitz
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from rag.vector_store import ainit_table, aget_store

DATA_DIR = os.path.join(_PROJECT_ROOT, "Data")
BATCH_SIZE = 20

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)


def _pdf_to_chunks(file_path: str, source_name: str) -> list[Document]:
    """Extract full text from a PDF and split into chunks."""
    doc = fitz.open(file_path)
    txt = ""
    for i in range(len(doc)):
        txt += doc.get_page_text(i)
    doc.close()

    if not txt.strip():
        return []

    raw = Document(
        page_content=txt,
        metadata={"source": source_name},
    )
    chunks = splitter.split_documents([raw])

    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_id"] = str(uuid.uuid4())
        chunk.metadata["chunk_index"] = i + 1

    return chunks


async def _build() -> None:
    if not os.path.isdir(DATA_DIR):
        print(f"No Data directory found at {DATA_DIR}. Add PDFs and re-run.")
        return

    # Collect all PDF files recursively
    pdf_files = []
    for root, _, files in os.walk(DATA_DIR):
        for name in files:
            if name.lower().endswith(".pdf"):
                pdf_files.append((os.path.join(root, name), name))

    if not pdf_files:
        print("No PDF files found in Data/. Add PDFs and re-run.")
        return

    print(f"Found {len(pdf_files)} PDF(s). Initialising vector table...")
    await ainit_table()

    store = await aget_store()
    total_chunks = 0

    for file_path, filename in pdf_files:
        source_name = os.path.splitext(filename)[0]
        print(f"\nProcessing {filename} ...")

        chunks = _pdf_to_chunks(file_path, source_name)
        if not chunks:
            print(f"  ⚠ No text extracted from {filename}, skipping.")
            continue

        # Batch upload — mirrors the notebook pattern
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (len(chunks) - 1) // BATCH_SIZE + 1
            print(f"  Uploading batch {batch_num}/{total_batches} ...")
            await store.aadd_documents(batch)

        total_chunks += len(chunks)
        print(f"  ✓ {len(chunks)} chunks indexed.")

    print(f"\n✅ Done! {total_chunks} total chunks indexed into LEGAL_VECTOR_DB.")


if __name__ == "__main__":
    asyncio.run(_build())