Samvada
=======

A fullstack LLM chat app featuring real-time stream routing (supporting Gemini, ChatGPT, Claude, and offline mocks) and a live telemetry dashboard to track latency, token usage, and API success rates.




---

Getting Started
---------------

THE QUICK WAY (DOCKER COMPOSE)
If you have Docker Desktop running, you can boot the entire stack (frontend, backend, database) with a single command.

1. Configure your keys: Copy the backend configuration template:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Open backend/.env and paste your Gemini, OpenAI, or Anthropic keys. If you don't have keys, you can leave them blank—the app will automatically switch to a simulated offline fallback mode so you can still test it.

2. Spin it up:
   ```bash
   docker compose up --build
   ```
   The backend will auto-run Prisma migrations to set up the SQLite database file in a persistent Docker volume, compile both applications, and start them.
   - Frontend runs at: http://localhost:3000
   - Backend runs at: http://localhost:3001


THE LOCAL WAY (NO DOCKER)
If you prefer running it bare-metal on your machine:

1. Backend setup:
   Copy the template, install dependencies, sync the database schema, and start the NestJS dev server:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npx prisma db push
   npm run start:dev
   ```

2. Frontend setup:
   Install dependencies and start the Next.js development server from the root directory:
   ```bash
   npm install
   npm run dev
   ```
   Access the app at http://localhost:3000.

---

Architecture Overview
---------------------

The app is split into a Next.js frontend (App Router) and a NestJS backend.

┌────────────────────────┐      Direct Client-side Fetch      ┌────────────────────────┐
│                        ├───────────────────────────────────>│                        │
│   Next.js Frontend     │                                    │     NestJS Backend     │
│   (Port 3000)          │<───────────────────────────────────┤     (Port 3001)        │
│                        │      Server-Sent Events (SSE)      │                        │
└────────────────────────┘                                    └───────────┬────────────┘
                                                                          │
                                                                   Prisma │ ORM
                                                                          ▼
                                                              ┌────────────────────────┐
                                                              │       SQLite DB        │
                                                              │    (dev.db / Volume)   │
                                                              └────────────────────────┘

FRONTEND (NEXT.JS)
The frontend uses standard client-side React components (using "use client").
- Chat page ("/"): Connects to the backend via SSE (fetch with reader stream) to pull chunks in real time. It allows switching between Gemini, ChatGPT, Claude, and a Mock Local.
- Dashboard ("/dashboard"): Hits the /logs/metrics endpoint and uses Recharts to graph total requests, latency trends, system error rates, and model usage metrics.
- Styling: Handled entirely with custom CSS variables (no Tailwind) to support a glassmorphism dark theme out of the box.

BACKEND (NESTJS)
The backend coordinates API routing, database logging, and streaming responses:
- Routing & SSE: The /chat/stream endpoint accepts chat parameters and responds with an event stream.
- LLM Service: Connects to the official @google/generative-ai, openai, and @anthropic-ai/sdk libraries. If an API key is missing or invalid, it gracefully falls back to an offline word-by-word streaming simulation so the UI doesn't crash.
- Telemetry Wrapper (LlmLoggerWrapper): Intercepts LLM calls, measures latency (start time to finish), extracts token counts (or estimates them if the provider doesn't return usage metadata), and logs the prompt, response, and errors to the database.

---

Schema Design Decisions
-----------------------

We use SQLite (managed via Prisma) for data storage. SQLite was chosen because it's file-based, requiring zero extra infrastructure or database containers to manage locally.

The schema (backend/prisma/schema.prisma) consists of three models:
1. ChatSession: Holds the metadata for a conversation thread.
2. ChatMessage: Relates to a session. Uses a Cascade delete behavior so that deleting a chat session automatically cleans up its message history.
3. LlmInferenceLog: A flat log table that captures every API request made to the language models.
   - Indexes: Added explicit database indexes on sessionId, status, and createdAt. This is crucial because the dashboard performs group-by and filter operations on these columns to build charts. Without indexes, dashboard loading would slow down exponentially as the log table grows.

---

Tradeoffs Made
--------------

- Hardcoded localhost URLs: The frontend makes requests directly to http://localhost:3001. While setting this up via an environment variable is cleaner, hardcoding it simplifies the build. Because Next.js compiles assets for the client's browser, using localhost:3001 ensures the browser knows how to route to the backend container without needing complex build-time IP configuration.
- SQLite for Logs: Writing high-frequency logs to SQLite can lead to lockouts if multiple write events occur simultaneously (due to SQLite's file-locking mechanism). However, for a prototype/dev environment, the trade-off is worth the zero-setup convenience.
- Token Estimation: Not all providers return exact token usage on streaming chunks. For OpenAI and Anthropic streams, we fallback to estimating the token count (characters / 4) if metadata is unavailable, which is close enough for dashboard visualization but not accurate enough for production billing.

---

What We'd Improve With More Time
--------------------------------

1. Dynamic Frontend API Endpoint: Inject a NEXT_PUBLIC_API_URL config variable rather than hardcoding localhost:3001, enabling the app to be deployed in environments where the backend lives on a different server.
2. Move to PostgreSQL/TimescaleDB: SQLite will quickly bottleneck under concurrent writes. We would replace it with PostgreSQL, and ideally TimescaleDB for the logs table since telemetry is purely time-series data.
3. True Token Counting: Integrate token count packages (like tiktoken for OpenAI and equivalent tokenizers for Gemini/Anthropic) to calculate exact token usage rather than estimating.
4. Authentication: Add user accounts so that sessions and logs are tied to specific users, preventing users from seeing each other's chat histories and metrics.
