# System Configuration & Setup

This document provides a comprehensive overview of the system architecture, design decisions, and implementation details for this Next.js authentication project.

## Project Overview

A Next.js 16 application with secure authentication, built for small-scale private use. The system prioritizes security, simplicity, and ease of maintenance.

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

**Schema**: Single `users` table
```typescript
{
  id: text (primary key)
  name: text (nullable)
  email: text (unique, not null)
  password: text (not null, hashed)
  createdAt: timestamp_ms
  updatedAt: timestamp_ms
}
```

**Rationale**:
- Perfect for single-instance deployments
- No external database server required
- Easy backup (single file: `data/database.db`)
- Sufficient for small-scale private use
- Zero operational complexity

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

## Project Structure

```
burberry/
├── app/
│   ├── actions/
│   │   └── auth.ts              # Server action for login with rate limiting
│   ├── api/
│   │   └── auth/[...nextauth]/
│   │       └── route.ts         # Auth.js API route with rate limiting
│   ├── components/
│   │   └── login-form.tsx       # Login form component
│   ├── lib/
│   │   ├── db.ts                # Database connection
│   │   ├── rate-limit.ts        # In-memory rate limiter
│   │   └── schema.ts            # Drizzle schema
│   ├── login/
│   │   └── page.tsx             # Login page
│   ├── layout.tsx               # Root layout with SessionProvider
│   ├── page.tsx                 # Protected home page
│   └── providers.tsx            # Client-side providers
├── components/ui/               # shadcn components
├── data/
│   └── database.db              # SQLite database (gitignored)
├── drizzle/                     # Migration files
├── scripts/
│   └── create-user.ts           # User creation helper
├── auth.ts                      # Auth.js configuration
├── drizzle.config.ts            # Drizzle ORM config
├── middleware.ts                # Route protection
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

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Auth.js Documentation](https://authjs.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [bcrypt Information](https://en.wikipedia.org/wiki/Bcrypt)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Last Updated**: 2026-01-31
**System Version**: 1.0
**Next.js Version**: 16.1.6
