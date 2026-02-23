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
PORT=3000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

4. Run development server:
```bash
npm run dev
```

The server will start on http://localhost:3000

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

### API Proxy (Protected)

All endpoints require `X-Session-ID` header.

- `POST /api/rag` - RAG query (with streaming)
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation
- `PUT /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/filters` - Get filters
- `PUT /api/filters` - Update filters
- `GET /api/changelog` - Get changelog
- `GET /api/onboarding` - Get onboarding content
- `GET /api/about` - Get about content

All API requests are proxied to the Clojure backend with:
- `X-API-Key` header (Clojure API authentication)
- `X-User-Email` header (user context)

## Development

### Run with auto-reload:
```bash
npm run dev
```

### Type check:
```bash
npm run check
```

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
