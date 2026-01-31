# System Configuration & Setup

This document provides a comprehensive overview of the system architecture, design decisions, and implementation details for this Next.js authentication project.

**Documentation Organization:**
- **CLAUDE.md** (this file) - System architecture and design decisions
- **docs/** - Detailed documentation (API reference, implementation plans, guides)
- **README.md** - Project overview and quick start

## Project Overview

A Next.js 16 application with secure authentication and a wrestling prediction system, built for small-scale private use. The system prioritizes security, simplicity, and ease of maintenance.

**Core Features:**
- User authentication and session management with role-based access control
- Wrestling event and match tracking
- Prediction system for match outcomes and custom predictions
- Contrarian mode gameplay
- Historical tracking and scoring
- RESTful API with comprehensive CRUD operations
- Admin permissions for system management

## Technology Stack

- **Framework**: Next.js 16.1.6 with App Router
- **Runtime**: Bun (package manager and runtime)
- **Database**: SQLite (local file-based)
- **ORM**: Drizzle ORM with libsql client
- **Authentication**: Auth.js (NextAuth v5) - credentials provider only
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 4
- **TypeScript**: Version 5

## Architecture Decisions

### 1. Authentication Strategy

**Choice**: Credentials-only authentication with JWT sessions

**Rationale**:
- Small-scale private system doesn't require OAuth providers
- Simplified schema (single `users` table vs. 4 tables)
- No external dependencies for auth providers
- JWT sessions eliminate need for session table
- Reduced complexity and maintenance overhead

**Trade-offs**:
- Cannot easily add social login later without schema migration
- JWT sessions can't be invalidated server-side without additional infrastructure

### 2. Database Architecture

**Choice**: SQLite with local file storage

**Configuration**:
```typescript
// app/lib/db.ts
const client = createClient({
  url: process.env.DB_FILE_NAME! // "file:data/database.db"
});
export const db = drizzle(client);
```

**Schema**: 16 tables total
- **User Management** (1 table): `users`
- **Core Wrestling Data** (6 tables): `brands`, `wrestlers`, `wrestlerNames`, `tagTeams`, `tagTeamMembers`, `championships`
- **Events & Matches** (4 tables): `events`, `matches`, `matchParticipants`, `matchCombatantChampionships`
- **Prediction System** (5 tables): `matchPredictions`, `customPredictionTemplates`, `eventCustomPredictions`, `userCustomPredictions`, `userEventContrarian`

**Rationale**:
- Perfect for single-instance deployments
- No external database server required
- Easy backup (single file: `data/database.db`)
- Sufficient for small-scale private use
- Zero operational complexity
- Comprehensive data model supporting complex wrestling scenarios

**Trade-offs**:
- Not suitable for multi-instance deployments
- Limited concurrent write performance
- Requires file system access

### 3. Password Security

**Implementation**: bcryptjs with automatic salting

```typescript
// Hashing (10 rounds)
const hashedPassword = await bcrypt.hash(password, 10);

// Verification
const passwordMatch = await bcrypt.compare(password, hashedPassword);
```

**Rationale**:
- 10 salt rounds = 2^10 (1,024) iterations
- Automatic unique salt per password
- Industry-standard, battle-tested algorithm
- Rainbow table resistant
- Computationally expensive for attackers

**Performance**: ~100-200ms per hash (acceptable for login operations)

### 4. Rate Limiting Strategy

**Choice**: In-memory rate limiter (custom implementation)

**Configuration**:
```typescript
// Login form: 5 attempts per 15 minutes per IP
rateLimit(`login:${ip}`, { limit: 5, windowMs: 15 * 60 * 1000 });

// Auth API: 10 requests per 15 minutes per IP
rateLimit(`auth-api:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
```

**Implementation Details**:
- In-memory Map storage with automatic cleanup (5-minute intervals)
- Sliding window algorithm
- IP-based identification
- User-friendly error messages with time remaining
- Standard HTTP 429 responses with rate limit headers

**Rationale**:
- No external dependencies (Redis, etc.)
- Zero operational overhead
- Sufficient for single-instance deployments
- Fast performance (in-memory lookups)
- Simple to understand and maintain

**Trade-offs**:
- Limits reset on server restart
- Not shared across multiple instances
- Memory usage grows with unique IPs (mitigated by cleanup)

**Migration Path**: Interface designed to easily swap for Redis-backed solution if needed

### 5. Route Protection

**Implementation**: Next.js middleware + server-side session checks

```typescript
// middleware.ts
export { auth as middleware } from '@/auth';
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};
```

**Protected Routes**: Everything except:
- `/login` - Login page
- `/api/*` - API routes (have their own protection)
- `/_next/*` - Next.js internals
- `/favicon.ico` - Static assets

**Page-level Protection**:
```typescript
// app/page.tsx
const session = await auth();
if (!session) redirect('/login');
```

**Rationale**:
- Defense in depth (middleware + page-level)
- Automatic redirects to login
- Server-side validation (can't be bypassed)
- Simple and explicit

### 6. Role-Based Access Control (RBAC)

**Choice**: Two-tier permission system (Normal Users & Admins)

**Implementation**:
```typescript
// Database schema
users: {
  isAdmin: boolean (default: false)
}

// JWT token includes isAdmin claim
// Session includes isAdmin flag
// API middleware enforces permissions
```

**Permission Model**:

**Normal Users** can:
- View all data (GET endpoints)
- Make and manage their own predictions
- Enable/disable contrarian mode for themselves

**Admins** can:
- Everything normal users can do, PLUS:
- Create, update, delete all entities (brands, wrestlers, events, matches, etc.)
- Enter match results and custom prediction answers
- Change event status (open → locked → completed)
- Trigger event scoring

**API Protection**:
```typescript
// Admin-only endpoint
export const POST = apiHandler(async (req) => {
  // Create brand logic
}, { requireAdmin: true });

// User-accessible endpoint
export const GET = apiHandler(async (req) => {
  // List brands logic
}); // No requireAdmin - all authenticated users can access
```

**Rationale**:
- Simple two-tier model sufficient for small-scale use
- Server-side enforcement prevents bypass
- JWT-based for stateless validation
- Default to non-admin (secure by default)
- Easy to promote users to admin via database update

**Trade-offs**:
- No granular permissions (event manager, scorer, etc.)
- Cannot invalidate admin status until token expires (JWT limitation)
- Requires manual database update to change admin status

### 7. RESTful API Architecture

**Choice**: Comprehensive REST API with all logic encapsulated in endpoints

**Design Principles**:
- All business logic in API routes (not in UI)
- Type-safe with TypeScript throughout
- Consistent error handling and response format
- Support for auto-refreshing UIs via polling
- Rate limiting on all endpoints (100 req/min default)

**API Coverage**:
- **Core Entities**: Brands, Wrestlers, Tag Teams, Championships (CRUD)
- **Events & Matches**: Full lifecycle management with participants
- **Predictions**: Match predictions, custom predictions, contrarian mode
- **Scoring**: Automated scoring engine with leaderboard

**Total Endpoints**: ~70 endpoints across 11 entity types

**Authentication**: All endpoints require valid session
**Authorization**: 28 endpoints require admin privileges (marked with `[ADMIN ONLY]` in API.md)

**Example API Flow**:
```typescript
// Frontend makes API call
const response = await apiClient.createBrand({ name: 'WWE' });

// API handler enforces auth + permissions
export const POST = apiHandler(async (req) => {
  const body = await parseBody(req);
  validateRequired(body, ['name']);
  // ... create brand logic
  return apiSuccess(newBrand, 201);
}, { requireAdmin: true });

// Returns typed response or throws appropriate error
```

**Benefits**:
- UI is purely presentational
- Easy to add different frontends (mobile app, CLI, etc.)
- API can be consumed by external tools
- Testing is straightforward (test APIs directly)
- Business logic centralized and reusable

**Documentation**: Complete API reference in `API.md` with request/response examples

## Project Structure

```
burberry/
├── app/
│   ├── actions/
│   │   └── auth.ts              # Server action for login with rate limiting
│   ├── api/                     # RESTful API endpoints (~70 total)
│   │   ├── auth/[...nextauth]/  # Auth.js authentication
│   │   ├── brands/              # Brand CRUD
│   │   ├── wrestlers/           # Wrestler CRUD + name history
│   │   ├── tag-teams/           # Tag team CRUD + members
│   │   ├── championships/       # Championship CRUD
│   │   ├── events/              # Event CRUD + custom predictions + scoring
│   │   ├── matches/             # Match CRUD + participants
│   │   └── predictions/         # User predictions (matches, custom, contrarian)
│   ├── components/
│   │   └── login-form.tsx       # Login form component
│   ├── lib/
│   │   ├── api-client.ts        # Type-safe API client
│   │   ├── api-helpers.ts       # API middleware & utilities
│   │   ├── api-types.ts         # TypeScript type definitions
│   │   ├── db.ts                # Database connection
│   │   ├── rate-limit.ts        # In-memory rate limiter
│   │   └── schema.ts            # Drizzle schema (16 tables)
│   ├── login/
│   │   └── page.tsx             # Login page
│   ├── layout.tsx               # Root layout with SessionProvider
│   ├── page.tsx                 # Protected home page
│   └── providers.tsx            # Client-side providers
├── components/ui/               # shadcn components
├── data/
│   └── database.db              # SQLite database (gitignored)
├── docs/                        # Project documentation
│   ├── API.md                   # Complete API reference
│   ├── ADMIN_PERMISSIONS_PLAN.md       # Admin implementation plan
│   └── ADMIN_IMPLEMENTATION_COMPLETE.md # Implementation summary
├── drizzle/                     # Migration files
├── scripts/
│   ├── create-user.ts           # Interactive user creation (admin flag support)
│   └── seed-wrestling-data.ts   # Initial data seeding
├── types/
│   └── next-auth.d.ts           # Auth.js TypeScript extensions
├── auth.ts                      # Auth.js configuration (JWT + RBAC)
├── drizzle.config.ts            # Drizzle ORM config
├── middleware.ts                # Route protection
├── CLAUDE.md                    # System architecture (this file)
└── .env                         # Environment variables
```

## Security Features

### Multi-Layer Defense

1. **Password Security**
   - bcryptjs hashing (10 rounds)
   - Automatic salting
   - Secure storage (only hashed passwords in DB)

2. **Rate Limiting**
   - Login form: 5 attempts/15min per IP
   - Auth API: 10 requests/15min per IP
   - User-friendly error messages
   - Standard HTTP headers

3. **Route Protection**
   - Middleware-level blocking
   - Server-side session validation
   - Automatic redirects to login

4. **Session Security**
   - JWT-based (stateless)
   - HTTP-only cookies (via Auth.js)
   - Secure flag in production
   - CSRF protection built-in

### Attack Mitigation

| Attack Type | Mitigation |
|------------|------------|
| Brute Force | Rate limiting (5 attempts/15min) |
| DDoS | API rate limiting (10 req/15min) |
| Credential Stuffing | IP-based rate limits + bcrypt delays |
| Rainbow Tables | Unique salts per password |
| Session Hijacking | HTTP-only, Secure cookies |
| CSRF | Auth.js built-in protection |
| SQL Injection | Drizzle ORM parameterized queries |
| Unauthorized Access | Role-based access control (RBAC) |
| Privilege Escalation | Server-side permission validation |

### Security Features - Admin Permissions

5. **Role-Based Access Control**
   - Two-tier system: Normal Users and Admins
   - `isAdmin` flag in database (default: false)
   - Admin status included in JWT token
   - Server-side validation on every request

6. **Permission Enforcement**
   - 28 endpoints require admin privileges
   - 403 Forbidden for unauthorized access
   - Cannot be bypassed from frontend
   - Middleware-level enforcement (`requireAdmin()`)

7. **Admin Management**
   - Interactive user creation script
   - Manual promotion via database update
   - Password never exposed in API responses
   - Admin actions logged (can be enhanced)

## Environment Variables

```bash
# Database
DB_FILE_NAME=file:data/database.db

# Auth.js
AUTH_SECRET=your-secret-key-here-change-this-in-production
AUTH_URL=http://localhost:3000
```

**Production Requirements**:
- Generate `AUTH_SECRET`: `openssl rand -base64 32`
- Update `AUTH_URL` to production domain
- Ensure `data/` directory is writable

## npm Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:studio": "drizzle-kit studio",
  "db:create-user": "tsx scripts/create-user.ts"
}
```

## RESTful API Structure

The application features a comprehensive RESTful API that encapsulates all business logic.

### API Organization

```
app/api/
├── auth/[...nextauth]/route.ts    # Auth.js endpoint
├── brands/                         # Brand management
│   ├── route.ts                   # GET (all), POST (admin)
│   └── [id]/route.ts              # GET, PATCH (admin), DELETE (admin)
├── wrestlers/                      # Wrestler management
│   ├── route.ts                   # GET (all), POST (admin)
│   ├── [id]/route.ts              # GET, PATCH (admin), DELETE (admin)
│   └── [id]/names/route.ts        # GET name history
├── tag-teams/                      # Tag team management
│   ├── route.ts                   # GET (all), POST (admin)
│   ├── [id]/route.ts              # GET, PATCH (admin), DELETE (admin)
│   └── [id]/members/              # Member management
│       ├── route.ts               # GET, POST (admin)
│       └── [memberId]/route.ts    # PATCH (admin), DELETE (admin)
├── championships/                  # Championship management
│   ├── route.ts                   # GET (all), POST (admin)
│   └── [id]/route.ts              # GET, PATCH (admin), DELETE (admin)
├── events/                         # Event management
│   ├── route.ts                   # GET (all), POST (admin)
│   ├── [id]/route.ts              # GET, PATCH (admin), DELETE (admin)
│   ├── [id]/custom-predictions/   # Event custom predictions (admin)
│   │   ├── route.ts               # GET, POST (admin)
│   │   └── [predictionId]/route.ts # PATCH (admin), DELETE (admin)
│   └── [id]/score/route.ts        # GET (leaderboard), POST (admin - score)
├── matches/                        # Match management
│   ├── route.ts                   # POST (admin)
│   ├── [id]/route.ts              # GET, PATCH (admin), DELETE (admin)
│   └── [id]/participants/         # Participant management
│       ├── route.ts               # GET, POST (admin)
│       └── [participantId]/route.ts # PATCH (admin), DELETE (admin)
└── predictions/                    # User predictions
    ├── matches/                   # Match predictions
    │   ├── route.ts              # GET (own), POST (create/update)
    │   └── [id]/route.ts         # GET (own), PATCH, DELETE
    ├── custom/                    # Custom predictions
    │   ├── route.ts              # GET (own), POST (create/update)
    │   └── [id]/route.ts         # GET (own), PATCH, DELETE
    └── contrarian/                # Contrarian mode
        ├── route.ts              # GET (own), POST (enable/update)
        └── [eventId]/route.ts    # GET (own), DELETE
```

### API Helpers & Utilities

**File**: `app/lib/api-helpers.ts`

```typescript
// Authentication middleware
requireAuth(req)        // Validates user session
requireAdmin(req)       // Validates admin privileges

// Rate limiting
requireRateLimit(req, { limit: 100, windowMs: 60000 })

// API handler wrapper
apiHandler(handler, {
  requireAuth: true,    // Default: require authentication
  requireAdmin: false,  // Optional: require admin
  rateLimit: {...}      // Optional: custom rate limit
})

// Response helpers
apiSuccess(data, status)  // Standard success response
apiError(message, status) // Standard error response

// Validation
validateRequired(data, ['field1', 'field2'])
parseBody(req)           // Parse JSON with error handling
generateId(prefix)       // Generate unique IDs
```

### Permission Summary

**Total Endpoints**: ~70
- **Public Endpoints**: 0 (all require authentication)
- **User Endpoints**: ~42 (authenticated users can access)
  - All GET endpoints (read-only)
  - Own predictions (match, custom, contrarian)
- **Admin Endpoints**: 28 (require `isAdmin: true`)
  - All POST/PATCH/DELETE for entities
  - Match result entry
  - Event scoring

### API Client

**File**: `app/lib/api-client.ts`

Type-safe frontend client with methods for all endpoints:

```typescript
// Usage in frontend
import { apiClient } from '@/app/lib/api-client';

// Automatically type-safe
const brands = await apiClient.getBrands();
const brand = await apiClient.createBrand({ name: 'WWE' }); // Admin only

// Error handling
try {
  await apiClient.createBrand({ name: 'Test' });
} catch (error) {
  // 403 if not admin
  // 401 if not authenticated
}
```

### API Response Format

**Success**:
```json
{
  "id": "brand_123",
  "name": "WWE",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error**:
```json
{
  "error": "Forbidden - Admin access required"
}
```

**Rate Limit Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
Retry-After: 60
```

### Admin User Management

**Create Admin User**:
```bash
bun db:create-user
# Prompts for: Email, Password, Name, Is Admin? (y/n)
```

**Promote Existing User**:
```bash
sqlite3 data/database.db "UPDATE users SET isAdmin = 1 WHERE email = 'user@example.com';"
```

**Check Admin Status**:
```typescript
// In API route
const session = await auth();
const isAdmin = session?.user?.isAdmin;

// In React component
const { data: session } = useSession();
const isAdmin = session?.user?.isAdmin;
```

## Development Workflow

### Initial Setup
```bash
bun install
bun db:migrate
bun db:create-user
bun dev
```

### Database Migrations
```bash
# 1. Modify schema (app/lib/schema.ts)
# 2. Generate migration
bun db:generate

# 3. Review migration file (drizzle/*.sql)
# 4. Apply migration
bun db:migrate
```

### User Management
```bash
# Create new user
bun db:create-user

# Browse database
bun db:studio
```

## Design Patterns

### Server Actions for Mutations
```typescript
// app/actions/auth.ts
'use server';
export async function loginAction(email: string, password: string) {
  // Rate limiting
  // Authentication
  // Return result
}
```

**Benefits**:
- Type-safe client-server communication
- No API route boilerplate
- Easy to add middleware (rate limiting)
- Progressive enhancement ready

### Simplified Data Model
- Single `users` table (no OAuth tables)
- JWT sessions (no session table)
- Minimal fields (id, name, email, password, timestamps)

**Benefits**:
- Easy to understand
- Simple to query
- Lower maintenance
- Fewer moving parts

### Defense in Depth
- Middleware protection
- Page-level session checks
- Rate limiting at multiple layers
- Input validation
- Secure defaults

## Performance Characteristics

### Authentication Flow
1. User submits login form
2. Rate limit check (~1ms in-memory lookup)
3. Database query for user (~5-10ms SQLite)
4. bcrypt comparison (~100-200ms)
5. JWT creation and cookie setting
6. Total: ~105-215ms

### Route Protection
1. Middleware checks JWT (~1-5ms)
2. Redirect if needed
3. Negligible overhead for authenticated requests

### Rate Limiter
- Lookup: O(1) - in-memory Map
- Cleanup: Every 5 minutes, O(n) where n = unique IPs
- Memory: ~100 bytes per IP entry

## Scalability Considerations

### Current Limitations
- **Single instance**: In-memory rate limiter doesn't scale horizontally
- **SQLite**: Limited concurrent writes (~1000 req/sec)
- **File-based**: Requires file system access

### Migration Path for Scale
1. **Database**: SQLite → PostgreSQL/MySQL
   - Update `app/lib/db.ts` connection
   - Minimal code changes (Drizzle ORM abstraction)

2. **Rate Limiting**: In-memory → Redis
   - Keep same interface in `app/lib/rate-limit.ts`
   - Swap implementation
   - No caller changes needed

3. **Sessions**: JWT → Database sessions
   - Add session table
   - Enable DrizzleAdapter
   - Better invalidation control

## Testing Strategy

### Manual Testing Checklist
- [ ] Visit `/` → redirects to `/login`
- [ ] Login with valid credentials → redirects to `/`
- [ ] Login with invalid credentials → error message
- [ ] Attempt 6 logins → rate limit message
- [ ] Sign out → redirects to `/login`
- [ ] Protected routes require auth

### Test User
```
Email: test@example.com
Password: password123
```

## Deployment Considerations

### Production Checklist
- [ ] Generate strong `AUTH_SECRET`
- [ ] Update `AUTH_URL` to production domain
- [ ] Ensure `data/` directory exists and is writable
- [ ] Set up database backups (`data/database.db`)
- [ ] Configure reverse proxy (nginx) for IP forwarding
- [ ] Enable HTTPS (required for secure cookies)
- [ ] Review rate limit thresholds
- [ ] Set up monitoring/logging

### Backup Strategy
```bash
# Backup database
cp data/database.db data/database.db.backup

# Restore database
cp data/database.db.backup data/database.db
```

### Reverse Proxy Configuration
Ensure `x-forwarded-for` or `x-real-ip` headers are set:
```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

## Known Issues & Limitations

1. **Rate limiter resets on restart**
   - Accept: Small-scale private use, restarts are rare
   - Mitigate: Use Redis for persistent rate limiting

2. **No account recovery**
   - Future: Add password reset functionality
   - Workaround: Admin creates new password via script

3. **No user registration**
   - Current: Admin creates users via `bun db:create-user`
   - Future: Add registration page if needed

4. **No 2FA**
   - Accept: Risk appropriate for private use
   - Future: Consider TOTP for sensitive operations

## Future Enhancements

### Potential Additions
- User registration page
- Password reset flow
- Email verification
- Account lockout after X failed attempts
- TOTP 2FA
- Audit logging (login attempts, IP addresses)
- Session management UI
- Admin dashboard

### Not Planned (Out of Scope)
- OAuth providers (Google, GitHub, etc.)
- Multi-tenancy
- Role-based access control (RBAC)
- API token authentication

---

# Wrestling Prediction System

## Overview

The wrestling prediction system allows authenticated users to make predictions on wrestling event match outcomes and custom predictions. The system supports complex match scenarios including multi-team matches, free-for-all battles, and a contrarian mode where players intentionally try to get everything wrong.

## Database Schema Design

### Core Entities

#### Brands (`brands`)
Wrestling promotions (WWE, AEW, etc.)
```typescript
{
  id: text (primary key)
  name: text (unique, not null)
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

#### Wrestlers (`wrestlers`)
Individual wrestlers with brand affiliation
```typescript
{
  id: text (primary key)
  currentName: text (not null)              // Denormalized for performance
  brandId: text (foreign key → brands)
  isActive: boolean (default: true)
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

**Design Decision**: `currentName` is denormalized to avoid JOINs for common queries. Full name history tracked separately.

#### Wrestler Names (`wrestlerNames`)
Historical tracking of wrestler name changes
```typescript
{
  id: text (primary key)
  wrestlerId: text (foreign key → wrestlers)
  name: text (not null)
  validFrom: timestamp_ms (not null)
  validTo: timestamp_ms (null = current name)
  createdAt: timestamp_ms
}
```

**Query Pattern**: Get wrestler's name at specific event date:
```sql
WHERE validFrom <= eventDate AND (validTo IS NULL OR validTo > eventDate)
```

#### Tag Teams (`tagTeams`)
Tag teams and factions
```typescript
{
  id: text (primary key)
  name: text (not null)
  brandId: text (foreign key → brands)
  isActive: boolean (default: true)
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

#### Tag Team Members (`tagTeamMembers`)
Wrestler membership in tag teams with temporal tracking
```typescript
{
  id: text (primary key)
  tagTeamId: text (foreign key → tagTeams)
  wrestlerId: text (foreign key → wrestlers)
  joinedAt: timestamp_ms (not null)
  leftAt: timestamp_ms (null = still active)
  createdAt: timestamp_ms
}
```

**Design Decision**: Supports roster changes over time. A wrestler can be in multiple tag teams historically.

#### Championships (`championships`)
Title belts by brand
```typescript
{
  id: text (primary key)
  name: text (not null)
  brandId: text (foreign key → brands)
  isActive: boolean (default: true)
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

### Events & Matches

#### Events (`events`)
Wrestling shows and pay-per-views
```typescript
{
  id: text (primary key)
  name: text (not null)
  brandId: text (foreign key → brands)
  eventDate: timestamp_ms (not null)
  status: text (default: 'open')          // 'open' | 'locked' | 'completed'
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

**Event Lifecycle:**
1. **open**: Users can make and edit predictions
2. **locked**: Event started, no more predictions allowed, admins can enter results
3. **completed**: Results finalized, scores calculated

#### Matches (`matches`)
Individual matches on an event card
```typescript
{
  id: text (primary key)
  eventId: text (foreign key → events)
  matchType: text (not null)              // 'singles', 'tag', 'triple_threat', 'battle_royal', etc.
  matchOrder: integer (not null)
  outcome: text (nullable)                 // 'winner', 'draw', 'no_contest'
  winningSide: integer (nullable)          // 1, 2, 3, 4... for team matches
  winnerParticipantId: text (nullable)     // For free-for-all matches
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

**Design Decision**: Dual winner tracking:
- **Team matches**: Use `winningSide` (1, 2, 3, 4...)
- **Free-for-all**: Use `winnerParticipantId` (specific wrestler/team)

#### Match Participants (`matchParticipants`)
Flexible participant system using polymorphic pattern
```typescript
{
  id: text (primary key)
  matchId: text (foreign key → matches)
  side: integer (nullable)                 // 1, 2, 3... for teams, NULL for free-for-all
  participantType: text (not null)         // 'wrestler' | 'tag_team'
  participantId: text (not null)           // References wrestlers.id or tagTeams.id
  entryOrder: integer (nullable)           // For Royal Rumble style matches
  createdAt: timestamp_ms
}
```

**Critical Design**: This polymorphic pattern supports any match configuration:

**Example 1: Traditional 1v1**
```
Side 1: {participantType: 'wrestler', participantId: 'roman-reigns', side: 1}
Side 2: {participantType: 'wrestler', participantId: 'seth-rollins', side: 2}
```

**Example 2: Tag Team + Individual vs 3 Individuals**
```
Side 1: {participantType: 'tag_team', participantId: 'hardy-boyz', side: 1}
Side 1: {participantType: 'wrestler', participantId: 'jeff-hardy', side: 1}
Side 2: {participantType: 'wrestler', participantId: 'wrestler-1', side: 2}
Side 2: {participantType: 'wrestler', participantId: 'wrestler-2', side: 2}
Side 2: {participantType: 'wrestler', participantId: 'wrestler-3', side: 2}
```

**Example 3: 3v3v3v3 (Four Teams)**
```
12 rows total with side values: 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4
Each with participantType: 'wrestler' and unique participantId
```

**Example 4: 25-Man Battle Royal (Free-for-All)**
```
25 rows with side: NULL, participantType: 'wrestler', unique participantId
```

**Example 5: Royal Rumble (Entry Order Matters)**
```
30 rows with side: NULL, entryOrder: 1-30
```

**Application Responsibility**: Validate that `participantId` exists in the appropriate table (`wrestlers` or `tagTeams`) based on `participantType`.

#### Match Combatant Championships (`matchCombatantChampionships`)
Links championships to specific combatants in a match
```typescript
{
  id: text (primary key)
  matchId: text (foreign key → matches)
  championshipId: text (foreign key → championships)
  participantType: text (not null)         // 'wrestler' | 'tag_team'
  participantId: text (not null)           // Who holds/defends the belt
  createdAt: timestamp_ms
}
```

**Use Case**: Indicates a title is on the line (e.g., "Roman Reigns (c) vs Cody Rhodes for WWE Championship")

### Prediction System

#### Match Predictions (`matchPredictions`)
User predictions for match winners
```typescript
{
  id: text (primary key)
  userId: text (foreign key → users)
  matchId: text (foreign key → matches)
  predictedSide: integer (nullable)        // For team matches (1, 2, 3, 4...)
  predictedParticipantId: text (nullable)  // For free-for-all matches
  isCorrect: boolean (nullable)            // NULL until scored
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
  UNIQUE(userId, matchId)                  // One prediction per user per match
}
```

**Prediction Logic:**
- **Team matches** (side NOT NULL in participants): User predicts `predictedSide`
  - Scoring: Compare with `matches.winningSide`
- **Free-for-all** (side IS NULL in participants): User predicts `predictedParticipantId`
  - Scoring: Compare with `matches.winnerParticipantId`

**Validation**: Application ensures only one field is populated based on match type.

#### Custom Prediction Templates (`customPredictionTemplates`)
Reusable prediction types
```typescript
{
  id: text (primary key)
  name: text (not null)
  description: text (nullable)
  predictionType: text (not null)          // 'time', 'count', 'wrestler', 'boolean', 'text'
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

**Seeded Templates:**
1. **First Blood** (type: 'time') - "When does X bleed in a given fight?"
2. **Physicality Counter** (type: 'count') - "How many times is 'Physicality' said?"
3. **Returns and Debuts** (type: 'wrestler') - "Which wrestler will return/debut?"
4. **Tables Broken** (type: 'count') - "How many tables get broken?"
5. **Will There Be Interference?** (type: 'boolean') - "Will there be outside interference?"

#### Event Custom Predictions (`eventCustomPredictions`)
Instance of a custom prediction on a specific event
```typescript
{
  id: text (primary key)
  eventId: text (foreign key → events)
  templateId: text (foreign key → customPredictionTemplates)
  question: text (not null)                // Customized question for this event

  // Answer fields - use appropriate one based on template type
  answerTime: timestamp_ms (nullable)
  answerCount: integer (nullable)
  answerWrestlerId: text (nullable)
  answerBoolean: boolean (nullable)
  answerText: text (nullable)

  isScored: boolean (default: false)
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

**Design Decision**: Multiple answer columns (sparse table) chosen over:
- JSON column (limited SQLite JSON support, harder to query)
- Separate tables per type (too many tables, complex unions)

**Customization Example**: Template "First Blood" → Event question "When does Roman Reigns bleed?"

#### User Custom Predictions (`userCustomPredictions`)
User's predictions for custom predictions
```typescript
{
  id: text (primary key)
  userId: text (foreign key → users)
  eventCustomPredictionId: text (foreign key → eventCustomPredictions)

  // User's prediction - use appropriate field based on template type
  predictionTime: timestamp_ms (nullable)
  predictionCount: integer (nullable)
  predictionWrestlerId: text (nullable)
  predictionBoolean: boolean (nullable)
  predictionText: text (nullable)

  isCorrect: boolean (nullable)            // NULL until scored
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
  UNIQUE(userId, eventCustomPredictionId)
}
```

**Scoring**: Application logic compares prediction field with corresponding answer field based on template type.

#### User Event Contrarian (`userEventContrarian`)
Tracks contrarian mode per user per event
```typescript
{
  id: text (primary key)
  userId: text (foreign key → users)
  eventId: text (foreign key → events)
  isContrarian: boolean (default: false)
  didWinContrarian: boolean (nullable)     // NULL until scored
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
  UNIQUE(userId, eventId)
}
```

**Contrarian Mode Logic:**
- User declares they're playing contrarian before event starts
- Goal: Get ALL match predictions wrong
- Scoring: If `didWinContrarian` is true, they automatically win regardless of point totals
- Must get EVERY match prediction incorrect to win

## Match Type Support Matrix

| Match Type | Side Values | Winner Field | Example |
|------------|-------------|--------------|---------|
| 1v1 Singles | 1, 2 | winningSide | Roman vs Seth |
| Tag Team | 1, 2 | winningSide | Hardy Boyz vs Usos |
| Triple Threat | 1, 2, 3 | winningSide | A vs B vs C |
| Fatal 4-Way | 1, 2, 3, 4 | winningSide | A vs B vs C vs D |
| 3v3v3v3 | 1, 2, 3, 4 | winningSide | 12 wrestlers, 4 teams |
| Battle Royal | NULL | winnerParticipantId | 25 wrestlers free-for-all |
| Royal Rumble | NULL (with entryOrder) | winnerParticipantId | 30 wrestlers, numbered entry |

## Database Performance

### Indexes
All tables include strategic indexes:
- Foreign keys indexed for JOIN performance
- User/event combinations indexed for prediction queries
- Event status indexed for filtering
- Match order indexed for sorting

### Query Patterns

**Get all matches with participants for an event:**
```typescript
const matches = await db
  .select()
  .from(matches)
  .where(eq(matches.eventId, eventId))
  .orderBy(matches.matchOrder);

const participants = await db
  .select()
  .from(matchParticipants)
  .where(inArray(matchParticipants.matchId, matchIds));
```

**Get user's predictions for an event:**
```typescript
const predictions = await db
  .select()
  .from(matchPredictions)
  .innerJoin(matches, eq(matches.id, matchPredictions.matchId))
  .where(and(
    eq(matchPredictions.userId, userId),
    eq(matches.eventId, eventId)
  ));
```

**Score match predictions after match completion:**
```typescript
// Team match
await db
  .update(matchPredictions)
  .set({
    isCorrect: sql`CASE
      WHEN ${matchPredictions.predictedSide} = ${winningSide} THEN 1
      ELSE 0
    END`
  })
  .where(eq(matchPredictions.matchId, matchId));

// Free-for-all match
await db
  .update(matchPredictions)
  .set({
    isCorrect: sql`CASE
      WHEN ${matchPredictions.predictedParticipantId} = ${winnerParticipantId} THEN 1
      ELSE 0
    END`
  })
  .where(eq(matchPredictions.matchId, matchId));
```

## Data Seeding

### Initial Seed Script
**File**: `scripts/seed-wrestling-data.ts`

```bash
bunx tsx scripts/seed-wrestling-data.ts
```

**Creates:**
- 2 brands (WWE, AEW)
- 5 custom prediction templates (time, count, wrestler, boolean)

### Future Data Management

Users will create:
- Wrestlers (via admin UI)
- Tag teams (via admin UI)
- Championships (via admin UI)
- Events and matches (via event management UI)
- Predictions (via prediction submission UI)

## Application Validation Requirements

Since the schema uses polymorphic relationships and flexible prediction types, the application layer must enforce:

1. **Match Participant Validation**
   - `participantId` exists in correct table based on `participantType`
   - Team matches have at least 2 participants
   - Sides are balanced (at least 1 participant per side)

2. **Event Status Transitions**
   - Only allow: open → locked → completed
   - Prevent prediction modifications when status is not 'open'

3. **Prediction Validation**
   - Match predictions: Validate correct field populated (predictedSide vs predictedParticipantId)
   - Custom predictions: Use correct field based on template's `predictionType`
   - Enforce prediction deadlines (before event status changes to 'locked')

4. **Contrarian Mode**
   - Can only enable before first prediction is made
   - Validate all predictions are incorrect to trigger auto-win

5. **Championship Tracking**
   - `participantId` in `matchCombatantChampionships` must exist in match participants

## Workflow Examples

### Creating an Event

1. Admin creates event (status: 'open')
2. Admin adds matches to event card (with matchOrder)
3. Admin adds participants to each match
4. Optionally link championships to combatants
5. Admin adds custom predictions to event
6. Users make predictions
7. Admin locks event (status: 'locked')
8. During event, admin enters results
9. Admin completes event (status: 'completed')
10. System scores all predictions

### User Prediction Flow

1. User views open events
2. User selects event
3. User views match card with participants
4. For each match:
   - Team match: User selects a side (1, 2, 3...)
   - Free-for-all: User selects specific wrestler
5. User answers custom predictions
6. User optionally enables contrarian mode
7. System saves all predictions
8. After event completes, user views scores

### Scoring Logic

**Match Predictions:**
```typescript
// Correct if predictedSide matches winningSide (team matches)
// OR predictedParticipantId matches winnerParticipantId (free-for-all)
isCorrect = (predictedSide === winningSide) ||
            (predictedParticipantId === winnerParticipantId)
```

**Custom Predictions:**
```typescript
// Based on predictionType from template
switch (predictionType) {
  case 'time':
    isCorrect = (predictionTime === answerTime)
  case 'count':
    isCorrect = (predictionCount === answerCount)
  case 'wrestler':
    isCorrect = (predictionWrestlerId === answerWrestlerId)
  case 'boolean':
    isCorrect = (predictionBoolean === answerBoolean)
  case 'text':
    isCorrect = (predictionText === answerText) // Exact match or fuzzy?
}
```

**Overall Winner:**
```typescript
// 1. Check if any contrarian won
const contrarianWinner = users.find(u =>
  u.didWinContrarian === true
);
if (contrarianWinner) return contrarianWinner;

// 2. Otherwise, highest score wins
const scores = users.map(u => ({
  userId: u.id,
  score: countCorrectPredictions(u, event)
}));
return scores.sort((a, b) => b.score - a.score)[0];
```

## Future Enhancements

### Planned Features (Out of Current Scope)
- Event management UI (create events, add matches)
- Prediction submission UI (user-friendly form)
- Results entry UI (admin enters match outcomes)
- Leaderboard and statistics dashboard
- Scoring calculation engine
- Historical analysis (user performance over time)
- Export predictions to PDF/CSV
- Email notifications (event starting, results available)
- Draft picks (fantasy-style wrestler selection)
- Achievements and badges

### Not Planned
- Real-time live scoring during events
- Integration with external wrestling APIs
- Mobile native apps
- Social features (comments, likes, sharing)
- Wagering or prizes

## Data Integrity

### Foreign Key Constraints
All relationships enforced at database level:
- User deletions cascade to predictions
- Event deletions cascade to matches and predictions
- Wrestler/team deletions require soft delete (isActive: false)

### Soft Deletes
Entities with historical importance use `isActive` flag:
- Wrestlers (preserve prediction history)
- Tag teams (preserve match history)
- Championships (preserve match history)

### Hard Deletes
Safe to hard delete:
- Events (if no predictions exist)
- Prediction templates (if not used in any events)

## Backup and Recovery

**Critical Data**:
- All data stored in `data/database.db`
- Single-file backup strategy

**Backup Frequency**:
- Before each event (manual)
- Daily automated backups recommended
- Before any schema migrations

**Recovery**:
```bash
# Restore from backup
cp data/database.db.backup data/database.db

# Verify integrity
sqlite3 data/database.db "PRAGMA integrity_check;"
```

## References

### External Documentation
- [Next.js Documentation](https://nextjs.org/docs)
- [Auth.js Documentation](https://authjs.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [bcrypt Information](https://en.wikipedia.org/wiki/Bcrypt)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### Project Documentation

**Documentation Files (in `docs/`):**
- **`docs/API.md`** - Complete RESTful API reference with all endpoints, request/response examples, and permission requirements
- **`docs/ADMIN_PERMISSIONS_PLAN.md`** - Detailed implementation plan for role-based access control
- **`docs/ADMIN_IMPLEMENTATION_COMPLETE.md`** - Implementation summary, testing checklist, and completion status

**Code Documentation:**
- **`app/lib/api-types.ts`** - TypeScript type definitions for all API requests and responses
- **`app/lib/api-client.ts`** - Type-safe frontend client for consuming the API
- **`app/lib/api-helpers.ts`** - API middleware and utility functions

### Quick Start

1. **Setup Database**:
   ```bash
   bun db:migrate
   ```

2. **Create Admin User**:
   ```bash
   bun db:create-user
   # Answer 'y' to "Is Admin?"
   ```

3. **Start Development Server**:
   ```bash
   bun dev
   ```

4. **Access API Documentation**:
   - Open `docs/API.md` for complete endpoint reference
   - Use `app/lib/api-client.ts` for type-safe API calls

---

**Last Updated**: 2026-01-31
**System Version**: 1.1
**Next.js Version**: 16.1.6
**API Endpoints**: ~70 total (28 admin-only)
