# Admin Permissions Implementation Plan

## Overview

This document outlines the implementation plan for adding role-based access control (RBAC) to the wrestling prediction system. The system will support two roles:
- **Normal Users**: Can make predictions only
- **Admins**: Can perform all operations (CRUD on all entities)

## Current State Analysis

### Authentication
- **Session Strategy**: JWT-based via Auth.js (NextAuth v5)
- **User Schema**: Simple users table with id, name, email, password, timestamps
- **Session Data**: Currently stores `id`, `email`, `name` in JWT token
- **Middleware**: `requireAuth()` validates session existence

### API Structure
- All endpoints require authentication via `apiHandler()` wrapper
- No permission differentiation currently exists
- All authenticated users can access all endpoints

## Permission Model

### User Operations (All Authenticated Users)
- **Match Predictions**
  - `POST /api/predictions/matches` - Create/update match predictions
  - `GET /api/predictions/matches` - View own predictions
  - `PATCH /api/predictions/matches/:id` - Update own predictions
  - `DELETE /api/predictions/matches/:id` - Delete own predictions

- **Custom Predictions**
  - `POST /api/predictions/custom` - Create/update custom predictions
  - `GET /api/predictions/custom` - View own predictions
  - `PATCH /api/predictions/custom/:id` - Update own predictions
  - `DELETE /api/predictions/custom/:id` - Delete own predictions

- **Contrarian Mode**
  - `POST /api/predictions/contrarian` - Enable/update contrarian mode
  - `GET /api/predictions/contrarian` - View own contrarian status
  - `GET /api/predictions/contrarian/:eventId` - View own event contrarian status
  - `DELETE /api/predictions/contrarian/:eventId` - Disable own contrarian mode

- **Read-Only Access**
  - `GET /api/brands` - View brands
  - `GET /api/brands/:id` - View specific brand
  - `GET /api/wrestlers` - View wrestlers
  - `GET /api/wrestlers/:id` - View specific wrestler
  - `GET /api/wrestlers/:id/names` - View wrestler name history
  - `GET /api/tag-teams` - View tag teams
  - `GET /api/tag-teams/:id` - View specific tag team
  - `GET /api/tag-teams/:id/members` - View tag team members
  - `GET /api/championships` - View championships
  - `GET /api/championships/:id` - View specific championship
  - `GET /api/events` - View events
  - `GET /api/events/:id` - View specific event
  - `GET /api/events/:id/custom-predictions` - View event custom predictions
  - `GET /api/matches/:id` - View specific match
  - `GET /api/matches/:id/participants` - View match participants
  - `GET /api/events/:id/score` - View leaderboard/scores

### Admin-Only Operations

- **Brands** (All write operations)
  - `POST /api/brands` - Create brand
  - `PATCH /api/brands/:id` - Update brand
  - `DELETE /api/brands/:id` - Delete brand

- **Wrestlers** (All write operations)
  - `POST /api/wrestlers` - Create wrestler
  - `PATCH /api/wrestlers/:id` - Update wrestler
  - `DELETE /api/wrestlers/:id` - Delete wrestler (soft)

- **Tag Teams** (All write operations)
  - `POST /api/tag-teams` - Create tag team
  - `PATCH /api/tag-teams/:id` - Update tag team
  - `DELETE /api/tag-teams/:id` - Delete tag team (soft)
  - `POST /api/tag-teams/:id/members` - Add member
  - `PATCH /api/tag-teams/:id/members/:memberId` - Update member
  - `DELETE /api/tag-teams/:id/members/:memberId` - Remove member

- **Championships** (All write operations)
  - `POST /api/championships` - Create championship
  - `PATCH /api/championships/:id` - Update championship
  - `DELETE /api/championships/:id` - Delete championship (soft)

- **Events** (All write operations)
  - `POST /api/events` - Create event
  - `PATCH /api/events/:id` - Update event (including status changes)
  - `DELETE /api/events/:id` - Delete event

- **Matches** (All write operations)
  - `POST /api/matches` - Create match
  - `PATCH /api/matches/:id` - Update match (including results)
  - `DELETE /api/matches/:id` - Delete match
  - `POST /api/matches/:id/participants` - Add participant
  - `PATCH /api/matches/:id/participants/:participantId` - Update participant
  - `DELETE /api/matches/:id/participants/:participantId` - Remove participant

- **Event Custom Predictions** (All write operations)
  - `POST /api/events/:id/custom-predictions` - Create custom prediction
  - `PATCH /api/events/:id/custom-predictions/:predictionId` - Update/answer custom prediction
  - `DELETE /api/events/:id/custom-predictions/:predictionId` - Delete custom prediction

- **Scoring**
  - `POST /api/events/:id/score` - Calculate event scores

## Implementation Steps

### 1. Database Schema Update

**File**: `app/lib/schema.ts`

Add `isAdmin` field to users table:

```typescript
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  isAdmin: integer('isAdmin', { mode: 'boolean' }).notNull().default(false), // NEW
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
});
```

**Migration Steps**:
1. Run `bun db:generate` to create migration file
2. Review generated SQL in `drizzle/` directory
3. Run `bun db:migrate` to apply migration
4. Default value: `false` (all existing users become normal users)

### 2. Auth Configuration Update

**File**: `auth.ts`

Update JWT and session callbacks to include `isAdmin`:

```typescript
async authorize(credentials) {
  // ... existing validation code ...

  return {
    id: user[0].id,
    email: user[0].email,
    name: user[0].name,
    isAdmin: user[0].isAdmin, // NEW
  };
}

// ... existing code ...

callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.isAdmin = user.isAdmin; // NEW
    }
    return token;
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string;
      session.user.isAdmin = token.isAdmin as boolean; // NEW
    }
    return session;
  },
}
```

**TypeScript Type Extension**:

Create or update `types/next-auth.d.ts`:

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
  }
}
```

### 3. API Helper Middleware

**File**: `app/lib/api-helpers.ts`

Add `requireAdmin` middleware:

```typescript
/**
 * Admin authorization middleware for API routes
 * Returns user session if user is admin, throws error response if not
 */
export async function requireAdmin(req: NextRequest) {
  const session = await requireAuth(req);

  if (!session.user?.isAdmin) {
    throw apiError('Forbidden - Admin access required', 403);
  }

  return session;
}

/**
 * Enhanced API handler with admin option
 */
export function apiHandler(
  handler: (req: NextRequest, context: { session: Awaited<ReturnType<typeof auth>>; params?: Record<string, string> }) => Promise<NextResponse>,
  options: {
    requireAuth?: boolean;
    requireAdmin?: boolean; // NEW
    rateLimit?: { limit: number; windowMs: number; prefix?: string };
  } = { requireAuth: true }
) {
  return async (req: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
    try {
      // Apply rate limiting if configured
      if (options.rateLimit) {
        requireRateLimit(req, options.rateLimit);
      }

      // Apply authentication if required
      let session = null;
      if (options.requireAuth) {
        session = await requireAuth(req);
      }

      // Apply admin check if required (NEW)
      if (options.requireAdmin) {
        session = await requireAdmin(req);
      }

      // Await params if they exist
      const params = context?.params ? await context.params : undefined;

      // Call the handler
      return await handler(req, { session, params });
    } catch (error) {
      // If error is already a NextResponse (from our helper functions), return it
      if (error instanceof NextResponse) {
        return error;
      }

      // Otherwise, log and return generic error
      console.error('API Error:', error);
      return apiError('Internal server error', 500);
    }
  };
}
```

### 4. Update API Endpoints

#### Pattern for Admin-Only Endpoints

**Before**:
```typescript
export const POST = apiHandler(async (req: NextRequest) => {
  // ... create brand logic ...
});
```

**After**:
```typescript
export const POST = apiHandler(async (req: NextRequest) => {
  // ... create brand logic ...
}, { requireAdmin: true }); // Add this option
```

#### Pattern for Mixed Permissions (Read vs Write)

Some endpoints need different permissions for different HTTP methods. Two approaches:

**Approach 1: Separate handlers (Recommended)**
```typescript
// GET - all authenticated users
export const GET = apiHandler(async (req: NextRequest) => {
  // ... list brands ...
});

// POST - admin only
export const POST = apiHandler(async (req: NextRequest) => {
  // ... create brand ...
}, { requireAdmin: true });
```

**Approach 2: Method-based check within handler**
```typescript
export const handler = apiHandler(async (req: NextRequest, { session }) => {
  if (req.method === 'GET') {
    // All authenticated users can read
    return apiSuccess(await getBrands());
  }

  if (req.method === 'POST') {
    // Check admin permission
    if (!session?.user?.isAdmin) {
      throw apiError('Forbidden - Admin access required', 403);
    }
    return apiSuccess(await createBrand(data));
  }
});
```

#### Endpoints to Update

**Admin-Only (All Methods)**:
- `app/api/brands/route.ts` - POST
- `app/api/brands/[id]/route.ts` - PATCH, DELETE
- `app/api/wrestlers/route.ts` - POST
- `app/api/wrestlers/[id]/route.ts` - PATCH, DELETE
- `app/api/tag-teams/route.ts` - POST
- `app/api/tag-teams/[id]/route.ts` - PATCH, DELETE
- `app/api/tag-teams/[id]/members/route.ts` - POST
- `app/api/tag-teams/[id]/members/[memberId]/route.ts` - PATCH, DELETE
- `app/api/championships/route.ts` - POST
- `app/api/championships/[id]/route.ts` - PATCH, DELETE
- `app/api/events/route.ts` - POST
- `app/api/events/[id]/route.ts` - PATCH, DELETE
- `app/api/matches/route.ts` - POST
- `app/api/matches/[id]/route.ts` - PATCH, DELETE
- `app/api/matches/[id]/participants/route.ts` - POST
- `app/api/matches/[id]/participants/[participantId]/route.ts` - PATCH, DELETE
- `app/api/events/[id]/custom-predictions/route.ts` - POST
- `app/api/events/[id]/custom-predictions/[predictionId]/route.ts` - PATCH, DELETE
- `app/api/events/[id]/score/route.ts` - POST

**Keep As-Is (User Operations)**:
- `app/api/predictions/matches/route.ts` - All methods
- `app/api/predictions/matches/[id]/route.ts` - All methods
- `app/api/predictions/custom/route.ts` - All methods
- `app/api/predictions/custom/[id]/route.ts` - All methods
- `app/api/predictions/contrarian/route.ts` - All methods
- `app/api/predictions/contrarian/[eventId]/route.ts` - All methods

**Read Access for All (No Changes to GET)**:
- All GET endpoints remain accessible to authenticated users

### 5. User Creation Script Update

**File**: `scripts/create-user.ts`

Add prompt for admin flag:

```typescript
import { db } from '../app/lib/db';
import { users } from '../app/lib/schema';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createUser() {
  const email = await question('Email: ');
  const password = await question('Password: ');
  const name = await question('Name: ');
  const isAdminInput = await question('Is Admin? (y/n): ');

  const isAdmin = isAdminInput.toLowerCase() === 'y';
  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    id: randomUUID(),
    email,
    password: hashedPassword,
    name,
    isAdmin,
  });

  console.log('\nUser created successfully!');
  console.log('Email:', email);
  console.log('Name:', name);
  console.log('Admin:', isAdmin);

  rl.close();
}

createUser().catch(console.error);
```

### 6. TypeScript Type Updates

**File**: `app/lib/api-types.ts`

Add `User` type and update related types:

```typescript
// Add User type
export type User = {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

// Note: password field intentionally excluded from API types for security
```

### 7. API Documentation Update

**File**: `API.md`

Add section on permissions:

```markdown
## Authentication & Permissions

All API endpoints require authentication via session cookies.

### User Roles

**Normal Users** can:
- Make and manage their own predictions (match, custom, contrarian)
- View all data (brands, wrestlers, events, matches, leaderboards)

**Admins** can:
- Perform all operations normal users can do
- Create, update, and delete all entities (brands, wrestlers, events, etc.)
- Enter match results and custom prediction answers
- Trigger event scoring

### Permission Errors

Attempting to access admin-only endpoints as a normal user returns:

```json
{
  "error": "Forbidden - Admin access required"
}
```

Status Code: `403 Forbidden`
```

Update endpoint documentation with permission indicators:

```markdown
### Create Brand [ADMIN ONLY]
```
POST /api/brands
```

### 8. Frontend API Client Update

**File**: `app/lib/api-client.ts`

No changes needed - client will receive 403 errors automatically for unauthorized operations. Frontend should:
1. Check user's `isAdmin` status from session
2. Hide/disable admin operations for normal users in UI
3. Handle 403 errors gracefully with user-friendly messages

### 9. Testing Checklist

#### Database Migration
- [ ] Generate migration successfully
- [ ] Review SQL for correctness
- [ ] Apply migration without errors
- [ ] Verify existing users have `isAdmin = false`

#### Auth Session
- [ ] Login as normal user, verify `isAdmin: false` in session
- [ ] Login as admin user, verify `isAdmin: true` in session
- [ ] Session persists across requests

#### API Endpoints - Normal User
- [ ] Can view all GET endpoints
- [ ] Can create/update/delete own predictions
- [ ] Cannot create brands (403)
- [ ] Cannot create wrestlers (403)
- [ ] Cannot create events (403)
- [ ] Cannot update match results (403)
- [ ] Cannot score events (403)

#### API Endpoints - Admin User
- [ ] Can perform all normal user operations
- [ ] Can create brands
- [ ] Can create wrestlers
- [ ] Can create events
- [ ] Can update match results
- [ ] Can score events
- [ ] Can delete entities

#### User Creation
- [ ] Can create normal user via script
- [ ] Can create admin user via script
- [ ] Password hashing works correctly

## Migration Path for Existing Data

### Step 1: Database Migration
```bash
# Generate migration
bun db:generate

# Review migration in drizzle/ directory

# Apply migration
bun db:migrate
```

### Step 2: Designate First Admin
```bash
# Use SQLite CLI or Drizzle Studio
sqlite3 data/database.db "UPDATE users SET isAdmin = 1 WHERE email = 'admin@example.com';"

# Or use Drizzle Studio
bun db:studio
# Navigate to users table and update isAdmin field
```

### Step 3: Test Admin Access
```bash
# Login as admin user
# Verify can access admin endpoints
# Verify normal users receive 403 errors
```

## Security Considerations

1. **Default to Non-Admin**: All new users are created as normal users by default
2. **Session-Based**: Admin status stored in JWT token, validated on every request
3. **Server-Side Validation**: All permission checks happen server-side (cannot be bypassed)
4. **No Password Field in API**: User password never exposed via API responses
5. **Audit Trail**: Consider adding admin action logging in future enhancement

## Future Enhancements

1. **Audit Logging**: Log all admin actions (who, what, when)
2. **More Granular Roles**: Event manager, scorer, etc.
3. **Admin Dashboard**: UI for managing users and permissions
4. **User Management API**: CRUD endpoints for managing users (admin only)
5. **Permission Groups**: Group permissions for easier management

## Rollback Plan

If issues arise after deployment:

1. **Session Issues**: Users can re-login to get new session with `isAdmin` field
2. **Database Issues**: Run migration rollback (if needed):
   ```bash
   # Drizzle doesn't support automatic rollback
   # Manual SQL to remove field:
   sqlite3 data/database.db "ALTER TABLE users DROP COLUMN isAdmin;"
   ```
3. **API Issues**: Remove `requireAdmin` option from endpoints, redeploy

## Estimated Implementation Time

- Database schema update: 15 minutes
- Auth configuration update: 30 minutes
- API helper middleware: 30 minutes
- Update all API endpoints: 2 hours
- User creation script: 30 minutes
- TypeScript types & documentation: 1 hour
- Testing: 2 hours

**Total**: ~6.5 hours

## Files to Modify

1. `app/lib/schema.ts` - Add `isAdmin` field
2. `auth.ts` - Include `isAdmin` in JWT/session
3. `types/next-auth.d.ts` - Type definitions (new file)
4. `app/lib/api-helpers.ts` - Add `requireAdmin` middleware
5. `scripts/create-user.ts` - Add admin flag prompt
6. `app/lib/api-types.ts` - Add User type
7. `API.md` - Document permissions
8. All admin-only API endpoints (~30 files)

## Summary

This implementation adds a simple but effective two-tier permission system:
- **Normal users** can make predictions and view data
- **Admins** can manage all entities and control the system

The design leverages existing authentication infrastructure and requires minimal changes to the current codebase. All permission checks happen server-side for security, and the default is safe (non-admin).

---

**Last Updated**: 2026-01-31
**Status**: Ready for Implementation
