# Wrestling Prediction System

Next.js 16 application with authentication and a wrestling prediction system for small-scale private use.

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **Runtime**: Bun
- **Database**: SQLite with Drizzle ORM
- **Auth**: Auth.js v5 (credentials provider, JWT sessions)
- **UI**: shadcn/ui + Tailwind CSS 4
- **TypeScript**: v5

## Quick Start

```bash
bun install
bun db:migrate
bun db:create-user    # Create admin user (answer 'y' to admin prompt)
bun dev
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
    db.ts                   # Database connection
    rate-limit.ts           # In-memory rate limiter
    schema.ts               # Drizzle schema (16 tables)
    validation-schemas.ts   # Zod schemas
  login/page.tsx            # Login page
  page.tsx                  # Protected home
auth.ts                     # Auth.js config
proxy.ts                    # Route protection middleware
data/database.db            # SQLite database (gitignored)
docs/API.md                 # Complete API reference
scripts/
  create-user.ts            # Interactive user creation
  seed-wrestling-data.ts    # Initial data seeding
```

## Architecture Decisions

### 1. Credentials-Only Auth
- Small private system - no OAuth needed
- Single `users` table, JWT sessions, no external dependencies

### 2. SQLite Database
- Single-file storage (`data/database.db`)
- Perfect for single-instance deployment
- Easy backup: just copy the file

### 3. In-Memory Rate Limiting
- Login: 5 attempts/15min per IP
- API: 100 requests/min per IP
- LRU eviction, tiered capacity, IPv6 normalization
- Resets on restart (acceptable for private use)

### 4. Two-Tier RBAC
- **Normal users**: View data, make predictions
- **Admins**: Create/update/delete entities, enter results, score events
- `isAdmin` flag in JWT, server-side enforcement

### 5. RESTful API Design
- All business logic in API routes
- Type-safe with validation schemas
- Consistent error handling with request IDs
- Pagination on list endpoints (20 items default, 100 max)

## Database Schema

**16 tables** in `app/lib/schema.ts`:

| Category | Tables |
|----------|--------|
| Users | `users` |
| Wrestling | `brands`, `wrestlers`, `wrestlerNames`, `tagTeams`, `tagTeamMembers`, `championships` |
| Events | `events`, `matches`, `matchParticipants`, `matchCombatantChampionships` |
| Predictions | `matchPredictions`, `customPredictionTemplates`, `eventCustomPredictions`, `userCustomPredictions`, `userEventContrarian` |

### Key Relationships
- Wrestlers belong to brands, can have name history
- Tag teams have members with join/leave dates
- Matches have flexible participant system (polymorphic: wrestler or tag_team)
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
| Session hijack | HTTP-only, Secure cookies |
| CSRF | Auth.js built-in protection |
| XSS | DOMPurify input sanitization |
| Timing attacks | Constant-time auth (100ms minimum) |
| Privilege escalation | Server-side RBAC enforcement |

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

**Rate Limit Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Development

```bash
bun dev                    # Start dev server
bun db:generate            # Generate migration from schema changes
bun db:migrate             # Apply migrations
bun db:studio              # Browse database
bun db:create-user         # Create user interactively
bun run build              # Production build
```

## Environment Variables

```bash
DB_FILE_NAME=file:data/database.db
AUTH_SECRET=your-secret-key    # Generate: openssl rand -base64 32
AUTH_URL=http://localhost:3000
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

---

**Last Updated**: 2026-01-31
