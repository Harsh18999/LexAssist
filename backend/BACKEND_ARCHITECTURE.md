# JurisAI Backend — Architecture & API Flow

> **Stack:** FastAPI · Neon PostgreSQL · PGVector · AWS Bedrock (DeepSeek v3.2 + Titan Embed v2) · LlamaIndex · PyMuPDF

---

## Table of Contents

1. [Directory Map](#1-directory-map)
2. [Request Lifecycle](#2-request-lifecycle)
3. [Startup Sequence](#3-startup-sequence)
4. [Authentication Flow](#4-authentication-flow)
5. [API Endpoints Reference](#5-api-endpoints-reference)
6. [Service Layer Deep Dive](#6-service-layer-deep-dive)
7. [Database Layer](#7-database-layer)
8. [AI / RAG Pipeline](#8-ai--rag-pipeline)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [Optimization Guide](#10-optimization-guide)

---

## 1. Directory Map

```
backend/
├── main.py                  # FastAPI app factory, CORS, startup hook
├── api/
│   ├── auth_routes.py       # /api/auth/register  /api/auth/login
│   ├── routes.py            # All protected routes
│   └── deps.py              # JWT Bearer dependency → get_current_user()
├── db/
│   └── database.py          # psycopg2 connection, init_db(), get_conn()
├── services/
│   ├── auth_service.py      # Register, login, token creation/decoding
│   ├── case_service.py      # CRUD for cases + brief persistence
│   ├── client_service.py    # CRUD for clients
│   ├── note_service.py      # Case notes
│   ├── hearing_service.py   # Timeline events
│   ├── chat_service.py      # RAG query, streaming SSE, chat history
│   ├── brief_service.py     # PDF → Bedrock → structured JSON brief
│   ├── workspace_service.py # File upload / document records
│   ├── case_index_service.py# Per-case PDF → PGVector indexing
│   ├── activity_service.py  # Audit log writes/reads
│   ├── stats_service.py     # AI usage counters
│   ├── dashboard_service.py # Aggregated dashboard stats
│   ├── insights_service.py  # AI/RAG telemetry
│   ├── document_service.py  # Legacy Data/ directory listing
│   ├── upload_service.py    # Rebuild index (truncate + re-index)
│   ├── bootstrap.py         # One-time sync of legacy docs
│   └── recent_uploads.py    # JSON-file-backed recent upload list
└── utils/
    └── storage.py           # read_json / write_json helpers

rag/
├── embedding_model.py       # BedrockEmbeddings (Titan v2) → LangchainEmbedding
├── vector_store.py          # PGVectorStore factory + default storage_context
├── query_engine.py          # Index + query engine (streaming, DeepSeek LLM)
├── load_documents.py        # SimpleDirectoryReader from project-root Data/
└── build_index.py           # CLI: load docs → embed → upsert PGVector
```

---

## 2. Request Lifecycle

Every HTTP request follows this path:

```
Client
  │  HTTP Request
  ▼
FastAPI (main.py)
  │  CORS middleware
  │
  ├─► /api/auth/*  ──────────────────► auth_routes.py  (no auth required)
  │                                          │
  │                                    auth_service → Neon Postgres
  │
  └─► /api/*  ──► deps.get_current_user()  (JWT Bearer check)
                        │ 401 if invalid
                        ▼
                   routes.py handler
                        │
                   service layer
                        │
              ┌─────────┴──────────┐
              │                    │
         Neon Postgres       AWS Bedrock / PGVector
         (psycopg2)          (LlamaIndex + LangChain)
              │                    │
              └─────────┬──────────┘
                        │
                  JSON response  or  SSE stream
```

---

## 3. Startup Sequence

```python
# main.py  @app.on_event("startup")
init_db()   # Creates all 9 Postgres tables if they don't exist
```

**Tables created on first boot:**

| Table | Purpose |
|---|---|
| `users` | Accounts (id, email, bcrypt hash) |
| `clients` | Lawyer's clients |
| `cases` | Legal cases (linked to client + user) |
| `documents` | Uploaded file records |
| `notes` | Case notes |
| `hearings` | Timeline events |
| `chat_messages` | AI chat history (SERIAL PK) |
| `activity_logs` | Audit trail (SERIAL PK) |
| `user_stats` | AI query counters |

PGVector creates `data_jurisai_legal_docs` automatically on first index build.

---

## 4. Authentication Flow

### Register — `POST /api/auth/register`

```
Client ──► auth_routes.register()
               │
           auth_service.register()
               │  bcrypt.hashpw(password)
               │  INSERT INTO users
               │  INSERT INTO user_stats  (initialize counters)
               │
           auth_service.create_token()   ← HS256 JWT, 72h TTL
               │
           { user, token }  ──► Client
```

### Login — `POST /api/auth/login`

```
Client ──► auth_routes.login()
               │
           auth_service.login()
               │  SELECT * FROM users WHERE email = %s
               │  bcrypt.checkpw(password, stored_hash)
               │
           create_token(user_id)
               │
           { user, token }  ──► Client
```

### Protected Route Guard (`deps.py`)

```
Authorization: Bearer <jwt>
    │
HTTPBearer.credentials ──► decode_token() ──► user_id (or None → 401)
                                                  │
                                     get_user(user_id) FROM postgres
                                                  │
                                      user dict injected into handler
```

---

## 5. API Endpoints Reference

### Auth (no token required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account, returns JWT |
| POST | `/api/auth/login` | Verify credentials, returns JWT |

### User / Dashboard

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/me` | — | Current user from token |
| GET | `/api/dashboard` | `dashboard_service` | Aggregated stats + activity |
| GET | `/api/settings` | `document_service` | User config + PGVector status |
| GET | `/api/insights` | `insights_service` | AI telemetry |
| GET | `/api/search` | clients + cases + docs | Global search |
| GET | `/api/health` | — | `{"status": "ok"}` |

### Clients

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/clients` | `client_service.list_clients` | List, optional `?search=` |
| POST | `/api/clients` | `client_service.create_client` | Create client |
| GET | `/api/clients/{id}` | `client_service.get_client` | Detail + cases + docs |

### Cases

| Method | Path | Service | Description |
|--------|------|---------|-------------|
| GET | `/api/cases` | `case_service.list_cases` | List, `?search=&client_id=` |
| POST | `/api/cases` | `case_service.create_case` | Create case |
| GET | `/api/cases/{id}` | `case_service.get_case` | Full detail: docs, notes, timeline, suggestions |
| PATCH | `/api/cases/{id}` | `case_service.update_case` | Partial update |
| POST | `/api/cases/{id}/documents` | `workspace_service` | Upload PDF to case |
| POST | `/api/cases/{id}/notes` | `note_service` | Add case note |
| POST | `/api/cases/{id}/timeline` | `hearing_service` | Add hearing/event |
| POST | `/api/cases/{id}/brief` | `brief_service` | AI-generate case brief |

### AI / Chat

| Method | Path | Returns | Description |
|--------|------|---------|-------------|
| POST | `/api/chat` | `text/event-stream` SSE | **Streaming** RAG query |
| GET | `/api/chat/history` | JSON | Chat history (`?case_id=` optional) |
| DELETE | `/api/chat/history` | JSON | Clear chat history |

### Documents / Knowledge Base

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload` | Upload to global knowledge base |
| POST | `/api/index/rebuild` | Truncate PGVector + re-index all docs |
| GET | `/api/knowledge-base` | List all documents |
| GET | `/api/documents/preview` | PDF text preview by path |

### Brief Generation

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/brief/generate` | Upload PDF → return JSON brief |
| POST | `/api/brief/pdf` | Upload PDF → return downloadable PDF brief |

---

## 6. Service Layer Deep Dive

### `auth_service.py`
- Password hashing: **bcrypt** (cost ~12 rounds)
- Token: **HS256 JWT**, 72h expiry, secret from `JURISAI_SECRET`
- `decode_token()` returns `None` on any error → `deps.py` raises HTTP 401

### `case_service.py`
- `list_cases()` — single `LEFT JOIN clients` query for `client_name`
- `update_case()` — **read-then-write**: fetch current → merge fields → UPDATE (two trips)
- `save_brief()` — stores raw JSON string in `brief_json`; `_parse_case()` inflates it on read
- `upcoming_hearings()` — `WHERE hearing_date IS NOT NULL AND hearing_date != ''`

### `chat_service.py`
- `stream_query()` is a **Python generator** feeding `StreamingResponse`
- Each LlamaIndex token → `data: {"type":"chunk","content":"..."}\n\n`
- Final event → `data: {"type":"done","citations":[...],"response_time_sec":1.2}\n\n`
- DB writes happen **after** stream is complete, not during

### `brief_service.py`
- Extracts text via **PyMuPDF** — first 4,000 chars
- Streams from `ChatBedrock` → collects all chunks → `_extract_json()`
- JSON extraction: strip markdown fences → regex `{...}` → `json.loads()` → graceful fallback

### `workspace_service.py`
- Saves files to `Data/workspace/{user_id}/cases/{case_id}/` or `.../knowledge/`
- After saving a case PDF, calls `case_index_service.index_case_document()` immediately

### `case_index_service.py`
- Reads first 20 pages (max 12,000 chars)
- Embeds via **Bedrock Titan** → inserts into PGVector with `{file_name, user_id, case_id, scope}` metadata
- Metadata enables **filtered retrieval** per case in chat

### `stats_service.py`
- `ON CONFLICT DO NOTHING` for safe first-time insert
- Counter updates: read → increment in Python → write (race condition possible)

### `dashboard_service.py`
- Calls 6+ services **sequentially** — dominant latency source

---

## 7. Database Layer

### Connection Pattern

```python
@contextmanager
def get_conn():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()      # ← new TCP per call
```

> ⚠️ **Every `with get_conn()` opens + closes a real TCP connection to Neon.**

### Cursor Pattern

```python
with get_conn() as conn:
    cur = conn.cursor()          # RealDictCursor → rows as dicts
    cur.execute(sql, (params,))  # %s placeholders (psycopg2)
    rows = cur.fetchall()
    cur.close()
```

### Schema Quick Reference

```sql
users(id TEXT PK, email UNIQUE, password_hash, name, created_at)
clients(id PK, user_id FK, name, phone, email, address, advocate, jurisdiction, created_at)
cases(id PK, user_id FK, client_id FK, title, case_number, court,
      filing_date, judgment_date, case_type, petitioner, respondent,
      judges, status DEFAULT 'Active', acts_involved,
      constitutional_articles, hearing_date TEXT, advocate,
      brief_json TEXT, created_at, updated_at)
documents(id PK, user_id FK, client_id, case_id, filename, file_path,
          doc_type DEFAULT 'judgment', size_bytes, created_at)
notes(id PK, user_id FK, case_id FK, content, created_at, updated_at)
hearings(id PK, user_id FK, case_id FK, event_date TEXT, event_type,
         court, description, created_at)
chat_messages(id SERIAL PK, user_id FK, case_id, role, content,
              citations TEXT, created_at)
activity_logs(id SERIAL PK, user_id, action, detail, created_at)
user_stats(user_id PK, ai_queries INT, total_response_ms INT,
           retrieval_count INT, last_indexed TEXT)
```

---

## 8. AI / RAG Pipeline

### Embedding Pipeline

```
PDF bytes
  │  PyMuPDF (fitz)
  ▼
Plain text (up to 12,000 chars per doc)
  │  LlamaIndex Document + metadata
  ▼
BedrockEmbeddings
  model_id: amazon.titan-embed-text-v2:0
  output:   1536-dim float vector
  │  LangchainEmbedding wrapper (LlamaIndex compat)
  ▼
PGVectorStore  →  table: data_jurisai_legal_docs
```

### Streaming Query Pipeline

```
User query  ──► chat_service.stream_query()
                      │
                _build_engine()
                      │  optional: MetadataFilters(case_id, user_id)
                      │
                LlamaIndex query_engine.query(prompt)
                      │
                PGVector ANN similarity search (top-5 chunks)
                      │
                Context assembled
                      │
                ChatBedrock(deepseek.v3.2, streaming=True)
                      │
                response_gen  ──►  SSE chunks  ──►  Client
                      │
                [after stream completes]
                save_message() + log_activity() + record_query()
```

### Brief Generation Pipeline

```
POST /api/cases/{id}/brief  (multipart PDF)
  │  file.read() → bytes
  ▼
brief_service.generate_brief_from_bytes()
  │  PyMuPDF → text[:4000]
  │  BRIEF_PROMPT.format(text=...)
  ▼
ChatBedrock(deepseek.v3.2, streaming=True)
  │  .stream([HumanMessage(prompt)])
  │  chunks collected → full_response string
  ▼
_extract_json(full_response)
  │  strip ```json fences
  │  regex {…} extraction
  │  json.loads()
  ▼
brief dict  →  save to cases.brief_json  +  return to client
```

---

## 9. Data Flow Diagrams

### Upload PDF + Auto-Index

```
POST /api/cases/{id}/documents
  │
  ├─ get_current_user()
  ├─ file.read() → bytes (in memory)
  │
  ├─ workspace_service.save_case_document()
  │       │  write to Data/workspace/{user}/{case}/{file}
  │       │  INSERT INTO documents
  │       │      (SELECT client_id FROM cases WHERE id=case_id)
  │       │
  │       └─ case_index_service.index_case_document()
  │                 │  fitz → text (20 pages max)
  │                 │  LlamaIndex Document(text, metadata)
  │                 │  Bedrock Titan → 1536-dim vector
  │                 └─ INSERT INTO data_jurisai_legal_docs
  │
  └─ activity_service.log_activity("Document Uploaded", filename)
```

### Dashboard Request

```
GET /api/dashboard
  │
  ├─ get_current_user()           [1 DB call]
  │
  └─ dashboard_service.get_dashboard(user_id)
        │
        ├─ stats_service.get_user_stats()          [1 DB call]
        ├─ client_service.count_clients()          [1 DB call]
        ├─ case_service.count_cases()              [1 DB call]
        ├─ case_service.count_cases("Active")      [1 DB call]
        ├─ workspace_service.count_documents()     [1 DB call]
        ├─ case_service.count_cases("Hearing")     [1 DB call]
        ├─ direct: COUNT(*) FROM cases (brief_json)[1 DB call]
        ├─ activity_service.get_activities()       [1 DB call]
        ├─ case_service.upcoming_hearings()        [1 DB call]
        └─ document_service.index_status()         [1 DB call]

        Total: ~10 sequential DB connections  ← optimization target
```

---

## 10. Optimization Guide

### 10.1 🔴 Critical — Add a Connection Pool

**Problem:** Every `with get_conn()` opens and closes a real TCP connection to Neon. ~10 connections per dashboard request.

**Fix:**

```python
# database.py
from psycopg2 import pool as pg_pool

_pool = pg_pool.ThreadedConnectionPool(
    minconn=2, maxconn=10, dsn=DATABASE_URL,
    cursor_factory=psycopg2.extras.RealDictCursor,
)

@contextmanager
def get_conn():
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
```

**Expected gain:** 3–10× reduction in DB latency.

---

### 10.2 🔴 Critical — Collapse Dashboard into One SQL Query

Replace 6 separate `COUNT` calls with a single query:

```sql
SELECT
  (SELECT COUNT(*) FROM clients   WHERE user_id = %s) AS total_clients,
  (SELECT COUNT(*) FROM cases     WHERE user_id = %s) AS total_cases,
  (SELECT COUNT(*) FROM cases     WHERE user_id = %s AND status = 'Active') AS active_cases,
  (SELECT COUNT(*) FROM documents WHERE user_id = %s) AS uploaded_documents,
  (SELECT COUNT(*) FROM cases     WHERE user_id = %s AND status = 'Hearing') AS pending_hearings,
  (SELECT COUNT(*) FROM cases     WHERE user_id = %s
   AND brief_json IS NOT NULL AND brief_json != '') AS recent_briefs
```

**Expected gain:** 6 round-trips → 1 round-trip.

---

### 10.3 🟡 Medium — Atomic Stat Increments

**Problem:** `record_query()` reads stats → increments in Python → writes. Concurrent requests overwrite each other.

**Fix:**

```sql
UPDATE user_stats SET
  ai_queries        = ai_queries + 1,
  total_response_ms = total_response_ms + %s,
  retrieval_count   = retrieval_count + %s
WHERE user_id = %s
```

---

### 10.4 🟡 Medium — `update_case` Without Prior Read

**Problem:** `update_case()` does SELECT then UPDATE (2 round-trips).

**Fix:** Use `COALESCE` in a single `UPDATE … RETURNING *`:

```sql
UPDATE cases SET
  title  = COALESCE(NULLIF(%s, ''), title),
  court  = COALESCE(NULLIF(%s, ''), court),
  updated_at = %s
WHERE id = %s AND user_id = %s
RETURNING *
```

---

### 10.5 🟡 Medium — `hearing_date` Should Be `DATE` Type

**Problem:** `hearing_date TEXT` — sorting only works if the format is `YYYY-MM-DD`. Range queries and `IS NOT NULL AND != ''` checks are fragile.

**Fix:** `ALTER TABLE cases ALTER COLUMN hearing_date TYPE DATE USING hearing_date::DATE;`

---

### 10.6 🟢 Low — PGVector HNSW Index

After initial index build, run once:

```sql
CREATE INDEX ON data_jurisai_legal_docs
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

Speeds up ANN search as document count grows.

---

### 10.7 🟢 Low — Missing Postgres Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_cases_user_id     ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_id   ON cases(client_id);
CREATE INDEX IF NOT EXISTS idx_cases_status      ON cases(user_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_user_id   ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_case    ON documents(user_id, case_id);
CREATE INDEX IF NOT EXISTS idx_chat_user_case    ON chat_messages(user_id, case_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id  ON activity_logs(user_id);
```

---

### 10.8 🟢 Low — Increase Brief PDF Context

**Problem:** Only 4,000 chars of a PDF are sent to the LLM. Long judgments are truncated.

**Fix:** Increase to 8,000–12,000 chars. DeepSeek v3 handles long contexts well.

---

### 10.9 🟢 Low — Move `recent_uploads.json` to Postgres

`recent_uploads.py` reads/writes a flat JSON file on every upload. Under concurrent requests this is a file-lock risk. Replace with a simple Postgres table or reuse `activity_logs`.

---

## Optimization Priority Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 | Connection pool | Medium | Very High |
| 🔴 | Collapse dashboard SQL | Low | High |
| 🟡 | Atomic stat increments | Low | Medium |
| 🟡 | update_case without SELECT | Low | Medium |
| 🟡 | `hearing_date` → DATE type | Low | Medium |
| 🟢 | PGVector HNSW index | Very Low | Medium (at scale) |
| 🟢 | Postgres column indexes | Very Low | Medium (at scale) |
| 🟢 | Larger PDF context window | Very Low | Low |
| 🟢 | Migrate recent_uploads to PG | Low | Low |
