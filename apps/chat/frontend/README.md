# Chat App Frontend

React/TypeScript frontend for the Chat application.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TanStack Query** (React Query) - Server state management
- **Zustand** - UI state management
- **Tailwind CSS** - Styling
- **Norwegian Design System** - UI components
- **react-markdown** + **KaTeX** - Markdown and math rendering

## Project Structure

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts          # API client for Node.js BFF
│   ├── components/
│   │   ├── auth/              # Auth components
│   │   ├── chat/              # Chat interface
│   │   ├── conversations/     # Conversation list
│   │   ├── layout/            # Layout components
│   │   └── ui/                # Shared UI components
│   ├── hooks/
│   │   ├── useAuth.ts         # Auth hooks
│   │   └── useConversations.ts # Conversation hooks
│   ├── pages/
│   │   ├── HomePage.tsx       # Home page
│   │   └── LoginPage.tsx      # Login page
│   ├── stores/
│   │   ├── auth.ts            # Auth state (Zustand)
│   │   └── ui.ts              # UI state (Zustand)
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   ├── App.tsx                # Root component
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── index.html                 # HTML template
├── package.json               # Dependencies
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite config
└── tailwind.config.js         # Tailwind config
```

## Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- npm/pnpm/yarn/bun

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at http://localhost:5173

During development, API requests are proxied to the Node.js BFF at `http://localhost:3000`.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
# Leave empty in development (uses Vite proxy)
VITE_API_URL=

# In production, set to your Node.js BFF URL:
# VITE_API_URL=https://bff.yoursite.com
```

## Features Implemented

### Current (MVP)
- ✅ Authentication (domain-based)
- ✅ Session management
- ✅ Routing with React Router
- ✅ API client with TypeScript
- ✅ React Query for server state
- ✅ Zustand for UI state
- ✅ Login page
- ✅ Home page

### To Implement
- [ ] Chat interface with streaming
- [ ] Conversation list sidebar
- [ ] Message rendering (Markdown + KaTeX)
- [ ] Source citations
- [ ] Filter panel
- [ ] Conversation management (create, rename, delete)
- [ ] Changelog page
- [ ] Onboarding page
- [ ] About page
- [ ] Mobile responsive design

## API Integration

The frontend communicates with the Node.js BFF via REST API:

### Auth Endpoints
- `POST /auth/login` - Login with email
- `POST /auth/logout` - Logout
- `GET /auth/me` - Get current user

### Conversation Endpoints
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation details
- `PUT /api/conversations/:id` - Update conversation
- `DELETE /api/conversations/:id` - Delete conversation

### Other Endpoints
- `POST /api/rag` - RAG query
- `GET /api/filters` - Get filters
- `PUT /api/filters` - Update filters
- `GET /api/changelog` - Get changelog
- `GET /api/onboarding` - Get onboarding content
- `GET /api/about` - Get about content

## Authentication Flow

1. User enters email on login page
2. Email domain is checked against allowlist (server-side)
3. Session ID is returned and stored in localStorage
4. Session ID is sent with all API requests via `X-Session-ID` header
5. Session expires after 7 days

## State Management

### Server State (React Query)
- User profile
- Conversations list
- Conversation details
- Messages
- Filters

### UI State (Zustand)
- Sidebar open/close
- Mobile menu
- Active conversation ID
- Toast notifications

## Development Tips

### Hot Module Replacement (HMR)
Vite provides instant HMR. Changes to React components will update without full page reload.

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### API Proxy
In development, `/api` and `/auth` requests are proxied to `http://localhost:3000` (Node.js BFF).

Configure in `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3000',
    '/auth': 'http://localhost:3000',
  },
}
```

## Deployment

### Static Hosting (Vercel, Netlify, Cloudflare Pages)

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist/` directory to your hosting provider

3. Set environment variable:
```bash
VITE_API_URL=https://bff.yoursite.com
```

4. Configure SPA routing (redirect all routes to `index.html`)

### Environment-Specific Builds

**Development:**
```bash
npm run dev
```

**Production:**
```bash
VITE_API_URL=https://bff.yoursite.com npm run build
```

## Next Steps

1. **Implement Chat Interface**
   - Message list component
   - Message input component
   - Streaming response handler
   - Markdown + KaTeX rendering

2. **Build Conversation Sidebar**
   - Conversation list
   - New conversation button
   - Search/filter
   - Folder organization

3. **Add Filters**
   - Filter panel component
   - Filter state management
   - Apply filters to RAG queries

4. **Polish UI**
   - Loading states
   - Error boundaries
   - Toast notifications
   - Mobile responsive

5. **Integrate Norwegian Design System**
   - Button components
   - Input components
   - Modal dialogs
   - Other UI elements

## Troubleshooting

### API requests failing
- Ensure Node.js BFF is running on port 3000
- Check browser console for CORS errors
- Verify session ID is being sent

### TypeScript errors
- Run `npm run type-check` to see all errors
- Ensure all dependencies are installed
- Check `tsconfig.json` configuration

### Vite not starting
- Clear node_modules and reinstall
- Check Node.js version (18+)
- Look for port conflicts (default: 5173)

## License

MIT
