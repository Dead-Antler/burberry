# Wrestling Prediction System

Next.js 16 application with authentication and a wrestling prediction system for small-scale private use.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **Runtime**: Bun
- **Database**: SQLite with Drizzle ORM
- **Auth**: Better Auth v1.4 (credentials provider, database sessions)
- **UI**: shadcn/ui + Tailwind CSS 4
- **TypeScript**: v5

## Quick Start

```bash
bun install
bun db:migrate
bun dev               # Creates admin user automatically on first run if ADMIN_EMAIL is set
```

## Project Structure

```
app/
  actions/auth.ts           # Login server action
  api/                      # RESTful API (~70 endpoints)
  components/               # UI components
  lib/
    api-client.ts           # Type-safe frontend client
    api-helpers.ts          # Middleware, validation, utilities
    api-errors.ts           # Standardized error messages
    api-types.ts            # TypeScript types
    auth.ts                 # Better Auth config
    auth-client.ts          # Better Auth client
    db.ts                   # Database connection
    init.ts                 # App initialization (admin user creation)
    schema.ts               # Drizzle schema
    settings-schemas.ts     # Settings type definitions
    settings-utils.ts       # Settings helper functions
    validation-schemas.ts   # Zod schemas
  login/page.tsx            # Login page
  page.tsx                  # Protected home
proxy.ts                    # Route protection middleware
data/database.db            # SQLite database (gitignored)
docs/API.md                 # Complete API reference
scripts/
  seed-wrestling-data.ts    # Initial data seeding
```

## Architecture Decisions

### 1. Credentials-Only Auth
- Small private system - no OAuth needed
- Better Auth with database-backed sessions
- Automatic admin user creation on first run

### 2. SQLite Database
- Single-file storage (`data/database.db`)
- Perfect for single-instance deployment
- Easy backup: just copy the file

### 3. Built-in Rate Limiting (Better Auth)
- Login: 5 attempts/15min per IP
- Sign-up: 5 attempts/hour per IP
- Other auth endpoints: 100 requests/min per IP
- In-memory storage, resets on restart (acceptable for private use)
- **Decision**: No additional rate limiting on prediction endpoints
  - All endpoints require authentication (natural rate limit)
  - Small-scale private system with manual user provisioning
  - Upsert logic prevents duplicate predictions per match
  - SSE connections limited per user to prevent resource exhaustion

### 4. Two-Tier RBAC
- **Normal users**: View data, make predictions
- **Admins**: Create/update/delete entities, enter results, score events
- `role` field in users table, server-side enforcement (verified against database)

### 5. RESTful API Design
- All business logic in API routes
- Type-safe with validation schemas
- Consistent error handling with request IDs
- Pagination on list endpoints (20 items default, 100 max)

## Database Schema

**15 tables** in `app/lib/schema.ts`:

| Category | Tables |
|----------|--------|
| Auth | `users`, `sessions`, `accounts`, `verifications` |
| Settings | `settings` |
| Wrestling | `brands`, `wrestlers`, `wrestlerNames`, `groups`, `groupMembers` |
| Events | `events`, `matches`, `matchParticipants` |
| Predictions | `matchPredictions`, `customPredictionTemplates`, `eventCustomPredictions`, `userCustomPredictions`, `userEventContrarian` |

### Key Relationships
- Wrestlers belong to brands, can have name history
- Groups have members with join/leave dates
- Matches have flexible participant system (polymorphic: wrestler or group)
- Match participants have optional `isChampion` flag to indicate champion status
- Predictions support team matches (winningSide) and free-for-alls (winnerParticipantId)

## Prediction System

### Event Lifecycle
1. **open** - Users make predictions
2. **locked** - Event started, admins enter results
3. **completed** - Scores calculated

### Match Types
- Team matches: Participants have `side` (1, 2, 3...), predict `winningSide`
- Free-for-all: Participants have `side: null`, predict specific `participantId`
- Royal Rumble: Free-for-all with `entryOrder`

### Contrarian Mode
- Declare before event starts
- Goal: Get ALL match predictions wrong
- Auto-win if achieved, regardless of points

## Security

| Attack | Mitigation |
|--------|------------|
| Brute force | Rate limiting (5/15min) |
| SQL injection | Drizzle ORM parameterized queries |
| Session hijack | HTTP-only, Secure cookies, database sessions |
| CSRF | Better Auth built-in protection |
| XSS | DOMPurify input sanitization |
| Timing attacks | Constant-time password verification |
| Privilege escalation | Server-side RBAC enforcement (database-verified) |

## Settings System

Key-value store for application configuration. See [docs/Settings.md](docs/Settings.md) for details.

- `auth.signupEnabled` - Enable/disable user registration (default: false)
- `predictions.reusableTemplates` - Custom prediction template strings

## API Reference

See [docs/API.md](docs/API.md) for complete endpoint documentation.

**Summary**: ~70 endpoints across 11 entity types
- 28 admin-only (marked `[ADMIN ONLY]`)
- All require authentication
- Support pagination, filtering, sorting

**Response Format**:
```json
// Success
{ "data": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }

// Error
{ "error": "Message here" }
```

## Development

```bash
bun dev                    # Start dev server
bun db:generate            # Generate migration from schema changes
bun db:migrate             # Apply migrations
bun db:studio              # Browse database
bun run build              # Production build
```

## Environment Variables

```bash
DB_FILE_NAME=file:data/database.db
AUTH_SECRET=your-secret-key       # Generate: openssl rand -base64 32
AUTH_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com     # Required for auto-creating admin on first run
# ADMIN_PASSWORD=optional         # If not set, random password is generated
```

## Deployment

- Generate strong `AUTH_SECRET` for production
- Update `AUTH_URL` to production domain
- Ensure `data/` directory is writable
- Set up database backups
- Configure reverse proxy for `x-forwarded-for` headers
- Enable HTTPS

## UI Guidelines

See [docs/UI.md](docs/UI.md) for detailed patterns. Key principles:

- **Component library**: shadcn/ui components, installed via `bunx shadcn@latest add <component>`
- **Page structure**: `SiteHeader` with breadcrumbs → content area with `flex flex-1 flex-col gap-4 p-4`
- **Data tables**: Card with `py-0 overflow-hidden` containing Table, responsive column hiding
- **CRUD dialogs**: Dialog for create/edit, AlertDialog for delete confirmation
- **State management**: Client components with `useState` for UI state, `apiClient` for data fetching
- **Loading/error states**: Skeleton placeholders, error cards with retry buttons, empty states

## Documentation Guidelines

- **CLAUDE.md**: Keep high-level (~200 lines max). Architecture decisions, not implementation details.
- **docs/**: Only evergreen reference docs (API.md, UI.md). No implementation plans, completion summaries, or dated fix logs.
- **Code comments**: Implementation details belong in the code itself.
- Delete temporary docs (plans, TODOs, fix logs) once work is complete.

## Code Review System

This project uses a structured, multi-pass review system. The review
process is defined in `REVIEW_AGENT.md` and the review criteria are
defined in `REVIEW_STANDARDS_NEXTJS.md`.

### Custom Commands

- **"review"** → Read and follow `REVIEW_AGENT.md`, target: full codebase
- **"review [path]"** → Read and follow `REVIEW_AGENT.md`, target: specified path
- **"review accessibility"** → Scoped review, §6 only
- **"review security"** → Scoped review, §8 only
- **"review caching"** / **"review data fetching"** → Scoped review, §2 only
- **"review server/client boundary"** → Scoped review, §1 and §2
- **"review api routes"** → Scoped review, §2, §4, §8, §9
- **"review predictions"** → Scoped review, §2, §5, §8, §9
- **"continue"** → Advance to the next review pass
- **"re-review after fixes"** → Re-review changed files for regressions

---

**Last Updated**: 2026-02-03
