# JurisAI ⚖️

JurisAI is an AI-powered legal assistant platform designed to help lawyers, legal researchers, and law students manage cases, analyze legal documents, and interact with case-specific AI copilots.

The platform combines:

- Retrieval-Augmented Generation (RAG)
- Vector Search
- AI-based Legal Brief Generation
- Case-specific Knowledge Isolation
- PDF Analysis
- Legal Research Assistance

---

# 🚀 Features

## 📂 Case Management
- Create and manage legal cases
- Store client and court information
- Track case status and updates

---

## 🤖 AI Legal Copilot
Each case gets its own AI assistant that:
- Answers only from that case’s documents
- Uses RAG-based retrieval
- Maintains isolated legal context
- Prevents cross-case information leakage

---

## 📄 AI Brief Generation
Upload a judgment PDF and automatically generate:
- Case summary
- Court details
- Final verdict
- Key legal issues
- Simplified explanation

---

## 🔍 RAG Pipeline
JurisAI uses Retrieval-Augmented Generation with:
- ChromaDB vector storage
- HuggingFace embeddings
- Metadata filtering
- Semantic retrieval

---

## 📚 Legal Knowledge Base
- Upload legal references
- Store acts, precedents, and judgments
- Semantic legal search

---

## 🔐 Authentication
- JWT-based authentication
- User-specific workspace isolation

---

# 🏗️ Tech Stack

## Frontend
- React
- Vite
- TailwindCSS

## Backend
- FastAPI
- Python

## AI / ML
- LlamaIndex
- ChromaDB
- HuggingFace Embeddings
- Ollama (Local LLM Support)
- OpenRouter/OpenAI Support

## PDF Processing
- PyMuPDF

---

# 🧠 AI Architecture

```text
PDF Upload
    ↓
PyMuPDF Text Extraction
    ↓
Chunking + Embeddings
    ↓
ChromaDB Vector Storage
    ↓
Metadata-filtered Retrieval
    ↓
LLM Response Generation
    ↓
AI Legal Brief / Chat Response
