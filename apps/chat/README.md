# Headless RAG Demo

A full-stack chat application with RAG (Retrieval-Augmented Generation) capabilities, featuring a React frontend and Node.js BFF that connects to a Clojure backend.

## Architecture

```
Frontend (React/Vite)
        ↓
  Node.js BFF
  (Auth + Proxy)
        ↓
  Clojure API
  (RAG + Data)
```

## Project Components

### [Frontend](./frontend/README.md)
React 19 + TypeScript + Vite frontend with:
- Domain-based authentication
- Chat interface with streaming support
- React Query for server state management
- Zustand for UI state
- Tailwind CSS + Norwegian Design System

**[View Frontend Documentation →](./frontend/README.md)**

### [Backend BFF](./backend-bff/README.md)
Node.js + Express backend-for-frontend providing:
- Domain-based email authentication
- Session management
- API proxy to Clojure backend
- Type-safe TypeScript implementation

**[View Backend BFF Documentation →](./backend-bff/README.md)**

## Quick Start

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm

### Setup

1. **Start the Backend BFF:**
   ```bash
   cd backend-bff
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   npm run dev
   ```

2. **Start the Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend BFF: http://localhost:5173

If you already have an older local `.env`, update your frontend/BFF port settings and Slack redirect URI to match the current development defaults.

## Development

Each component has its own README with detailed setup and development instructions:
- [Frontend Development Guide](./frontend/README.md#getting-started)
- [Backend BFF Development Guide](./backend-bff/README.md#development)

## Features

- Domain-based authentication (no passwords required)
- Chat interface with streaming responses
- RAG-powered conversations
- Session management
- Markdown + KaTeX rendering
- Conversation history management

## License

MIT
