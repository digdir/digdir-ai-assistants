# Migration from Deno to Node.js

## Summary

Successfully migrated the backend-bff from Deno to Node.js/Express while maintaining all functionality.

## Changes Made

### 1. Dependencies
- **Before**: Deno with Hono framework
- **After**: Node.js with Express framework

### 2. Configuration Files
- Removed: `deno.json`, `deno.lock`
- Added: `package.json`, `tsconfig.json`, `Dockerfile`
- Updated: `.gitignore`, `.env.example`, `README.md`

### 3. Code Changes

#### Environment Variables (`src/config.ts`)
- Changed from `Deno.env.get()` to `process.env`
- Changed from Deno dotenv to `dotenv` package
- Changed environment detection from `DENO_DEPLOYMENT_ID` to `NODE_ENV`

#### Session Management (`src/utils/session.ts`)
- Changed from Deno KV to in-memory Map storage
- Added manual expiration checking
- Added periodic cleanup with `setInterval`
- Changed from Deno's `crypto.randomUUID()` to Node's `randomUUID` from `crypto` module

#### Middleware (`src/middleware/`)
- Converted from Hono middleware to Express middleware
- Changed from `c` (Hono context) to `req`, `res`, `next` (Express)
- Updated type declarations for Express Request extension

#### Routes (`src/routes/`)
- Converted from Hono routers to Express routers
- Changed from `c.req.json()` to `req.body`
- Changed from `c.req.param()` to `req.params`
- Changed from `c.json()` to `res.json()`
- Updated streaming response handling for Express

#### Main Server (`src/main.ts`)
- Changed from Hono app to Express app
- Changed from `hono/middleware` logger to `morgan`
- Added `express.json()` middleware for body parsing
- Changed from `Deno.serve()` to `app.listen()`
- Updated server startup banner

### 4. Import Paths
- Changed all `.ts` imports to `.js` (ES modules convention)
- Updated type imports accordingly

## Key Differences

### Session Storage
The Deno version used built-in Deno KV for persistent session storage. The Node.js version uses in-memory storage which:
- **Pros**: Simple, no external dependencies, fast
- **Cons**: Sessions lost on server restart, doesn't work with multiple instances

For production, consider:
- Redis with `ioredis`
- Database (PostgreSQL, MongoDB)
- `express-session` with compatible store

### Module System
Both use ES modules, but Node.js requires `.js` extensions in imports even when the source files are `.ts`.

### Built-in APIs
- Deno's `crypto.randomUUID()` → Node's `crypto.randomUUID()`
- Deno's KV → In-memory Map
- Deno's built-in fetch → Node 18+ built-in fetch

## Testing Migration

1. Install dependencies:
```bash
npm install
```

2. Type check:
```bash
npm run check
```

3. Build:
```bash
npm run build
```

4. Run development server:
```bash
npm run dev
```

5. Test endpoints:
```bash
curl http://localhost:3000/health
```

## Deployment

The application can now be deployed using:
- Docker (see `Dockerfile`)
- Traditional Node.js hosting (Heroku, Railway, etc.)
- Serverless (AWS Lambda with Express adapter)
- Any platform supporting Node.js 18+

## Next Steps

Consider these enhancements for production:
1. Add Redis for session storage
2. Add logging framework (Winston, Pino)
3. Add request validation (Zod, Joi)
4. Add rate limiting (express-rate-limit)
5. Add security headers (helmet)
6. Add API documentation (Swagger/OpenAPI)
