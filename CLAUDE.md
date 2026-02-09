# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, Claude generates React/Tailwind code, and a live preview renders the result in real-time. All files exist in a virtual file system (in-memory, no disk writes).

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Vitest tests
npm run setup        # Install deps, generate Prisma client, run migrations
npm run db:reset     # Reset database to initial state
```

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui components
- Prisma with SQLite
- Anthropic Claude (claude-haiku-4-5) via Vercel AI SDK
- Monaco Editor for code editing
- Vitest + Testing Library for tests

## Architecture

### Core Data Flow

```
User Message → /api/chat (streaming) → Claude with tools → Tool executes on VirtualFileSystem → Preview updates
```

### Key Architectural Decisions

1. **Virtual File System** (`/src/lib/file-system.ts`): All generated code lives in-memory via the `VirtualFileSystem` class. AI tools modify this instance directly. The file system serializes to JSON for database persistence.

2. **React Contexts for State**:
   - `FileSystemContext` - Holds VirtualFileSystem instance, selected file, file operations
   - `ChatContext` - Wraps Vercel AI SDK's `useChat`, integrates with FileSystemContext

3. **AI Tool Integration**: Two tools defined in `/src/lib/tools/`:
   - `str_replace_editor` - Create/view/edit files (str_replace, insert, undo_edit commands)
   - `file_manager` - Rename/delete files

4. **Live Preview** (`/src/lib/transform/jsx-transformer.ts`): Babel transforms JSX, creates blob URLs for each file, generates HTML with import map (React from esm.sh, local files as blobs), renders in sandboxed iframe.

5. **Server vs Client Boundary**: Auth actions and Prisma queries are server-side. Interactive UI (chat, editor, preview) uses "use client" directive.

### Important Files

| Purpose | File |
|---------|------|
| Virtual file system | `/src/lib/file-system.ts` |
| AI model config | `/src/lib/provider.ts` |
| System prompt | `/src/lib/prompts/generation.tsx` |
| Chat endpoint | `/src/app/api/chat/route.ts` |
| Main layout | `/src/app/main-content.tsx` |
| JSX transform/preview | `/src/lib/transform/jsx-transformer.ts` |
| Auth (JWT sessions) | `/src/lib/auth.ts` |
| Route protection | `/src/middleware.ts` |
| Database schema | `/prisma/schema.prisma` |

### Database Schema

Defined in `/prisma/schema.prisma` - reference this file for the current structure.

- `User`: id, email, password (bcrypt), projects relation
- `Project`: id, name, userId (optional for anonymous), messages (JSON), data (serialized VirtualFileSystem)

## Environment Variables

```bash
ANTHROPIC_API_KEY=""   # If empty, uses mock provider (returns static code)
JWT_SECRET=""          # Auto-generated in dev, must set in production
```

## Code Patterns

- Entry point for generated components is always `/App.jsx`
- Use `@/` path alias for imports (configured in tsconfig.json)
- shadcn/ui components in `/src/components/ui/`
- Server actions in `/src/actions/`
- Use comments sparingly; only comment complex code
