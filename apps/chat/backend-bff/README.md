# Chat App BFF (Backend-for-Frontend)

A lightweight Node.js/Express backend that provides authentication and proxies requests to the Clojure RAG API.

## Features

- **Domain-based authentication**: Simple email domain allowlist (no passwords required)
- **Session management**: In-memory session storage (easily replaceable with Redis/DB)
- **API proxy**: Forwards authenticated requests to Clojure backend
- **Type-safe**: Full TypeScript implementation
- **Express-based**: Battle-tested Node.js framework

## Architecture

```
Frontend (React) → Node.js BFF → Clojure API
                   (Auth +          (RAG +
                    Proxy)           Data)
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm or yarn
- Running Clojure backend with API key

### Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Edit `.env` and configure:
```bash
ALLOWED_DOMAINS=yourcompany.com,example.org
RAG_API_URL=http://localhost:8080
RAG_API_KEY=rag_your_api_key_here
SESSION_SECRET=random-secret-here
PORT=5173
FRONTEND_URL=http://localhost:3000
# Optional for multiple allowed origins:
# FRONTEND_URLS=http://localhost:3000,https://your-tunnel.example.com
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:5173/auth/slack/callback
SLACK_TEAM_ID=
NODE_ENV=development
```

`SLACK_REDIRECT_URI` must point to the BFF callback endpoint that Slack should call back to.
The BFF then redirects the browser back to the frontend origin that initiated the Slack login flow.

4. Run development server:
```bash
npm run dev
```

The server will start on http://localhost:5173

If you already have an older local `.env`, update `PORT`, `FRONTEND_URL` and `SLACK_REDIRECT_URI` to match the current dev setup above.

## API Endpoints

### Authentication (Public)

#### POST `/auth/login`
Login with email (domain check only).

**Request:**
```json
{
  "email": "user@yourcompany.com"
}
```

**Response:**
```json
{
  "user": { "email": "user@yourcompany.com" },
  "sessionId": "uuid-here"
}
```

#### POST `/auth/logout`
Logout and delete session.

**Headers:**
- `X-Session-ID: <session-id>`

#### GET `/auth/me`
Get current user.

**Headers:**
- `X-Session-ID: <session-id>`

#### GET `/auth/slack/start`
Starts Slack OpenID Connect login flow.

#### GET `/auth/slack/callback`
Slack OAuth callback endpoint. Exchanges the code for user identity, validates domain/workspace, creates an app session, then redirects back to the initiating frontend origin with the session encoded in the URL fragment.

### API Proxy (Protected)

All endpoints require `X-Session-ID` header.

- `POST /api/rag` - RAG query (with streaming)
- `POST /api/retrieve` - Retrieve supporting chunks for a dataset-first query
- `GET /api/config/:root/nodes?tenant=...` - List visible config nodes under the API key's ceilings
- `POST /api/runtime/config/resolve` - Resolve runtime config for an explicit node slug
- `POST /api/dataset/config/resolve` - Resolve dataset config for an explicit node slug
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PUT /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/datasets` - List datasets visible to the configured API key
- `GET /api/datasets/:datasetId` - Get one visible dataset
- `GET /api/filters` - Get filters
- `PUT /api/filters` - Update filters
- `GET /api/changelog` - Get changelog
- `GET /api/onboarding` - Get onboarding content
- `GET /api/about` - Get about content

All API requests are proxied to the Clojure backend with:
- `X-API-Key` header (Clojure API authentication)
- `X-User-Id` header (public API user context)

The configured `RAG_API_KEY` must already be provisioned upstream with the correct
`dataset-scopes` and `allowed-config-keys` for every tenant this client uses. Public
requests are dataset-first and use `tenant` plus `dataset-config-key`; they must not send
legacy selector fields like `environment`, `pipeline`, `config-key`, or `tenant-config-key`.

This BFF can inject fixed public request selectors from:
- `RAG_PUBLIC_TENANT=<tenant>`
- `RAG_PUBLIC_DATASET_CONFIG_KEY=<dataset-config-key>`
- `RAG_PUBLIC_RUNTIME_CONFIG_KEY=<runtime-config-key>`
- `RAG_PUBLIC_AGENT_ID=<agent-id>`

If those env vars are set, `POST /api/rag` sends:
- `tenant`
- `dataset-config-key`
- `runtime-config-key`
- `agent-id`

and `POST /api/retrieve` sends:
- `tenant`
- `dataset-config-key`

When `POST /api/rag` continues an existing conversation via `conversation-id`, this BFF does
not forward `agent-id`. The upstream conversation's existing agent must remain authoritative.

This BFF also keeps optional config helper routes that can inject fixed node selectors from:
- `RAG_PLATFORM_CONFIG=<tenant>/platform/<node-slug>`
- `RAG_RUNTIME_CONFIG=<tenant>/runtime/<node-slug>`
- `RAG_DATASET_CONFIG=<tenant>/dataset/<node-slug>`

If those env vars are set, they must all target the same tenant. The config resolve
endpoints use the matching root-specific node slug.

This BFF currently targets the public Digdir RAG API surface only. The JWT-backed
operator console routes under `/console-api/...` are not proxied here because this
application does not maintain or forward the upstream `auth-token` cookie required
for operator access.

## Development

### Run with auto-reload:
```bash
npm run dev
```

### Type check:
```bash
npm run check
```

### Logging
Set `LOG_LEVEL=debug` to log upstream proxy request/response details, including
request IDs, proxied request bodies with sensitive fields redacted, upstream
status codes, and non-streaming response previews.

### Build for production:
```bash
npm run build
```

### Run in production:
```bash
npm start
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### Build and run with Docker:
```bash
docker build -t chat-bff .
docker run -p 3000:3000 --env-file .env chat-bff
```

### Environment Variables for Production

Make sure to set these in your production environment:
- `NODE_ENV=production`
- `RAG_API_KEY` (required in production)
- `SESSION_SECRET` (use a strong random value)
- `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` (if using Slack login)
- `SLACK_REDIRECT_URI` (must match Slack app config)
- Other configuration as needed

## Project Structure

```
backend-bff/
├── src/
│   ├── main.ts              # Entry point
│   ├── config.ts            # Configuration
│   ├── middleware/
│   │   ├── auth.ts          # Auth middleware
│   │   └── cors.ts          # CORS middleware
│   ├── routes/
│   │   ├── auth.ts          # Auth endpoints
│   │   └── proxy.ts         # Proxy to Clojure
│   ├── utils/
│   │   └── session.ts       # Session management
│   └── types/
│       └── api.ts           # Type definitions
├── package.json             # Node.js dependencies
├── tsconfig.json            # TypeScript configuration
├── .env.example             # Environment template
└── README.md
```

## Security

- **Domain allowlist**: Only approved email domains can log in
- **Session expiration**: Sessions expire after 7 days
- **API key protection**: Clojure API key never exposed to frontend
- **CORS**: Restricted to configured frontend URL

## Session Storage

The current implementation uses in-memory session storage for simplicity. For production use with multiple instances or server restarts, consider:

- **Redis**: Use `ioredis` or `redis` package
- **Database**: Store sessions in PostgreSQL, MongoDB, etc.
- **External session store**: Use `express-session` with a compatible store

## License

MIT
