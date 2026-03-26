# Projet.AI - Enterprise AI Platform with Multi-Agent LLM Orchestration

An enterprise-grade backend platform that delivers AI-powered insights through multiple specialized agents (General, PM, Dev, Document, Presentation) with RAG-first architecture, hybrid search capabilities, and MCP protocol support for seamless VS Code integration.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [API Endpoints](#api-endpoints)
- [AI Agents](#ai-agents)
- [Services](#services)
- [Tools](#tools)
- [Database Schema](#database-schema)
- [Installation](#installation)
- [Environment Variables](#environment-variables)

---

## Overview

**Projet.AI** is a full-stack AI platform designed for enterprise teams that combines:

- **Multi-Agent Architecture**: Role-based agents (General, PM, Dev) specialized for different user types
- **RAG-First Design**: Retrieval-Augmented Generation powered by vector embeddings and hybrid search
- **Intelligent Document & Presentation Generation**: Auto-generate markdown documents and PPTX presentations
- **Activity Tracking & Handoff**: Track developer activity and provide context during team transitions
- **MCP Protocol Support**: Model Context Protocol for VS Code and external IDE integration
- **Enterprise Security**: Schema-per-project database isolation

### Use Cases

- Code analysis and documentation generation
- Project management with AI insights
- Team activity tracking and reporting
- Smart presentation generation from project context
- Developer handoff with contextual information

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-Agent System** | Role-based agents (PM, Dev, General) with specialized capabilities |
| **RAG Pipeline** | Semantic search over codebase with hybrid search (vector + keyword) |
| **Multi-Repository Support** | Manage and index multiple repositories per project with tags |
| **Document Generation** | AI-powered markdown document creation with section planning |
| **Presentation Builder** | Generate PPTX presentations with auto-slides |
| **Response Caching** | Two-tier caching (L1 in-memory, L2 semantic) for 40-60% cost reduction |
| **Activity Logging** | Track all agent interactions and tool usage |
| **Handoff Context** | Transfer developer context during team transitions |
| **MCP Integration** | VS Code extension support via Model Context Protocol |
| **Per-Project Isolation** | Schema-per-project database security |

---

## Tech Stack

### Backend
- **Node.js / Express.js** - REST API server
- **MongoDB + Mongoose** - Application data storage
- **PostgreSQL + pgvector** - Vector database for semantic search

### AI & LLM
- **LangChain** - LLM orchestration and agent framework
- **LangGraph** - Multi-node state machines for complex agent workflows
- **OpenAI API** - LLM model provider (configurable per project)
- **HuggingFace / OpenAI Embeddings** - Semantic text embeddings
- **LangSmith** - LLM observability and debugging

### Frontend (app/)
- **React 19** - UI framework
- **React Router** - Navigation
- **Mermaid** - Diagram generation
- **Recharts** - Data visualization

### Integrations
- **MCP (Model Context Protocol)** - GitHub MCP adapters for tool access
- **GitHub API** - Repository management, issues, PRs, branches
- **Multer** - File upload handling

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend (Port 3000)                │
└────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Express Routes   │
                    │   /api/v1/* + SSE  │
                    └─────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐         ┌──────▼──────┐      ┌──────▼──────┐
   │Services │         │   Helpers   │      │ Controllers │
   └────┬────┘         └──────┬──────┘      └──────┬──────┘
        │                     │                    │
        └─────────────────────┼────────────────────┘
                              │
      ┌───────────────────────▼─────────────────────────┐
      │              Z-Agents (LangGraph)               │
      │  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌────────┐ │
      │  │ General  │ │   PM   │ │   Dev   │ │Doc/PPT │ │
      │  │  Agent   │ │ Agent  │ │  Agent  │ │ Agent  │ │
      │  └──────────┘ └────────┘ └─────────┘ └────────┘ │
      └───────────────────────┬─────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐         ┌─────▼─────┐       ┌─────▼─────┐
    │Response │         │  Hybrid   │       │  Vector   │
    │  Cache  │         │  Search   │       │   Store   │
    └─────────┘         └───────────┘       └───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ┌────▼────┐    ┌─────▼─────┐   ┌─────▼─────┐
         │PostgreSQL│    │  MongoDB  │   │ LangSmith │
         │(pgvector)│    │           │   │           │
         └──────────┘    └───────────┘   └───────────┘
```

### Key Design Patterns

1. **Schema-Per-Project Isolation**: Each project gets its own PostgreSQL schema (`project_{id}`)
2. **Semantic Caching**: Two-tier caching (L1 in-memory LRU, L2 vector-based)
3. **Multi-Agent Routing**: User roles determine agent type (PM → PM Agent, Dev → Dev Agent)
4. **RAG-First Approach**: Always query knowledge base before external tools
5. **LangGraph State Machines**: Complex workflows via stateful graph nodes

---

## API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | User login, returns JWT token |

### Projects (`/api/v1/projects`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create new project |
| GET | `/` | Get all assigned projects |
| GET | `/:id` | Get project details |
| PUT | `/:id` | Update project |
| DELETE | `/:id` | Delete project |
| GET | `/:id/repositories` | Get all repositories in project |
| POST | `/:id/repositories` | Add repository to project |
| PUT | `/:id/repositories/:repoId` | Update repository |
| DELETE | `/:id/repositories/:repoId` | Remove repository |
| GET | `/:id/copilot-config` | Get Copilot customization config |

### Chat & Agent (`/api/v1/chats`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:projectId/sessions` | List chat sessions |
| POST | `/:projectId/sessions` | Create chat session |
| DELETE | `/:projectId/sessions/:sessionId` | Delete chat session |
| GET | `/:projectId/history` | Get chat history |
| POST | `/:projectId` | **Main** - Send message to agent |

### Knowledge Base (`/api/v1/knowledgebase`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents` | Upload knowledge document (PDF/TXT) |
| GET | `/documents/project/:projectId` | List project documents |
| POST | `/documents/:docId/analyze` | Analyze and embed document |
| POST | `/projects/:projectId/analyze-repo` | Sync & embed GitHub repository |
| GET | `/sync-status/project/:projectId` | Get sync status |
| GET | `/sync-history/project/:projectId` | Get sync history |

### Presentations (`/api/v1/presentations`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create presentation (triggers PPT Agent) |
| GET | `/` | List all presentations |
| GET | `/search` | Search presentations |
| GET | `/:id` | Get presentation details |
| GET | `/:id/download` | Download as PPTX |
| DELETE | `/:id` | Delete presentation |

### Documents (`/api/v1/documents`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create document (triggers Doc Agent) |
| GET | `/` | List all documents |
| GET | `/search` | Search documents |
| GET | `/:id` | Get document details |
| PATCH | `/:id/content` | Update document content |
| PATCH | `/:id/publish` | Publish document |
| DELETE | `/:id` | Delete document |

### Users (`/api/v1/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all users |
| POST | `/` | Create new user |
| PUT | `/:id` | Update user |
| DELETE | `/:id` | Delete user |

### API Keys (`/api/v1/api-keys`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List API keys |
| POST | `/` | Create API key |
| PUT | `/:id` | Update API key |
| PATCH | `/:id/revoke` | Revoke API key |

### Activity Log (`/api/v1/activity`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user's activities |
| GET | `/project/:projectId` | Get project activities |
| GET | `/project/:projectId/team` | Get team activity summary |
| GET | `/project/:projectId/handoff/:userId` | Get handoff context |

### MCP Protocol (`/api/mcp`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sse` | Establish SSE connection |
| POST | `/sse` | Send MCP protocol messages |

---

## AI Agents

### 1. General Agent
**Purpose**: Versatile assistant for general inquiries

- **Tools**: Mermaid charts, markdown reporting, feedback storage
- **Use Cases**: Documentation requests, code analysis, Q&A
- **Access**: All users

### 2. PM Agent
**Purpose**: Product Manager focused on team insights

- **Tools**: 
  - GitHub tools (list/search issues, PRs)
  - Developer activity queries
  - Team progress tracking
  - Handoff context
  - Mermaid charts, markdown reporting
- **Use Cases**: Team health reports, sprint planning, progress summaries
- **Access**: PM and admin users

### 3. Dev Agent
**Purpose**: Developer-focused code generation and repository management

- **Tools**:
  - GitHub read: Issues, PRs, files, commits, branches
  - GitHub write: Create branches, push files, open PRs
  - Activity tracking for handoff scenarios
- **Modes**:
  - **Full Mode**: All GitHub tools enabled
  - **Read-Only Mode**: Only read operations
  - **RAG-First Mode**: Knowledge-base only
- **Use Cases**: Feature implementation, bug fixes, code reviews
- **Access**: Dev and admin users

### 4. Document Agent
**Purpose**: Generate professional markdown documents

- **Workflow**: Initializer → Planner → Section Generator (loop) → Finalizer
- **Features**: Progressive generation, auto-save, syntax-aware code blocks
- **Access**: PM and admin users

### 5. PPT Agent
**Purpose**: Generate PPTX presentations

- **Workflow**: Initializer → Planner → Slide Generator (loop) → Finalizer
- **Outputs**: PPTX file, JSON representation, HTML preview
- **Slide Types**: Cover, Content, Conclusion
- **Access**: PM and admin users

---

## Services

| Service | Description |
|---------|-------------|
| **Chat Service** | Routes messages to agents, manages sessions and RAG context |
| **Knowledge Base Service** | Document upload, repository syncing, embedding generation |
| **Vector Store Service** | Schema-per-project embeddings, similarity search |
| **Hybrid Search Service** | Semantic + keyword search with RRF fusion |
| **Presentation Service** | Presentation creation, slide management, PPTX export |
| **Document Service** | Markdown document CRUD with publishing workflow |
| **Project Service** | Project CRUD, multi-repo management, Copilot config |
| **Activity Log Service** | Track interactions, team metrics, handoff context |
| **Response Cache Service** | L1 in-memory + L2 semantic caching |
| **MCP Service** | Model Context Protocol server, IDE integration |
| **Schema Manager Service** | Per-project PostgreSQL schema management |
| **Indexing Service** | Convert documents to embeddings with Record Manager |

---

## Tools

### Common Tools
- **Mermaid Chart Tool**: Generate diagrams (flowcharts, sequence, state)
- **Markdown Report Tool**: Format data as markdown tables
- **Store Happy Feedback**: Capture user satisfaction signals

### Activity Tools
- **Get Developer Activity**: Query developer's recent work
- **Get Team Progress**: Team-level metrics and project progress
- **Get Handoff Context**: Full context for developer transitions

### Dev Tools (GitHub MCP)
**Read Operations**: 
- `issue_read`, `list_issues`, `search_issues`
- `pull_request_read`, `list_pull_requests`, `search_pull_requests`
- `get_file_contents`, `list_commits`, `get_commit`, `list_branches`

**Write Operations** (with confirmation):
- `create_branch`, `create_pull_request`, `push_files`, `create_or_update_file`

---

## Database Schema

### MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts with roles (admin, PM, dev, user) |
| `projects` | Project metadata, API keys, repositories |
| `chatsessions` | Chat history and conversation threads |
| `documents` | Generated markdown documents |
| `presentations` | Generated PPTX presentations |
| `slides` | Individual presentation slides |
| `docs` | Knowledge base documents from uploads |
| `syncstatus` | Repository sync progress tracking |
| `activitylogs` | User activity and tool usage |
| `apikeys` | API key management |

### PostgreSQL (pgvector)

**Schema**: `project_{ProjectId}`

| Table | Purpose |
|-------|---------|
| `embeddings` | Vector embeddings with metadata |

```sql
-- Embeddings table structure
id          UUID PRIMARY KEY
content     TEXT          -- Chunk of code/documentation
embedding   VECTOR(1536)  -- HuggingFace/OpenAI embeddings
metadata    JSONB         -- source, repoId, repoTag, etc.
created_at  TIMESTAMP
updated_at  TIMESTAMP
```

---

## Installation

### Prerequisites

- Node.js 16+
- MongoDB instance
- PostgreSQL with pgvector extension
- OpenAI API key
- HuggingFace API key (for embeddings)
- GitHub PAT (optional, for dev tools)

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd projet.ai

# Install dependencies
npm run setup:local

# Install frontend dependencies
npm install --prefix app

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development (backend + frontend)
npm run dev

# Or run separately:
npm run server   # Backend on port 5000
npm run app      # Frontend on port 3000
```

### Production Build

```bash
npm run build
```

---

## Environment Variables

```bash
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_DB=knowledgehub

# PostgreSQL + pgvector
PGVECTOR_DATABASE_URL=postgresql://user:pass@host:5432/vectordb
PGVECTOR_SSL=true

# OpenAI (Fallback/Default)
OPENAPI_URL=https://api.openai.com/v1
model=gpt-4o
REASONING_MODEL=gpt-4o-mini
OPENROUTER_API_KEY=sk-...

# HuggingFace (Embeddings)
HF_API_KEY=hf_...

# LangSmith (Optional)
LANGSMITH_API_KEY=ls-...
LANGSMITH_PROJECT=dev
LANGSMITH_ENDPOINT=https://api.smith.langchain.com

# Frontend
CLIENT_URL=http://localhost:3000

# LangGraph
LANGGRAPH_RECURSION_LIMIT=25

# GitHub PAT (optional - can be set per project)
# GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

---

## Project Structure

```
projet.ai/
├── app.js                    # Express app configuration
├── server.js                 # Server entry point
├── package.json              # Dependencies
├── app/                      # React frontend
├── common/                   # Shared constants
├── config/                   # Database configurations
├── controllers/              # Route handlers
├── helpers/                  # Business logic helpers
│   ├── chat.helpers.js       # RAG context building
│   ├── intentClassifier.js   # Query intent detection
│   ├── systemPromptBuilder.js# Dynamic prompt generation
│   └── ...
├── middlewares/              # Auth, upload, MCP middleware
├── models/                   # Mongoose models
├── openai/                   # LLM client configuration
├── orchestration/            # LangGraph orchestration
├── routes/                   # API route definitions
├── services/                 # Business logic services
├── tools/                    # Agent tool definitions
└── z-agents/                 # LangGraph agent implementations
```

---

## License

Proprietary - All rights reserved.
