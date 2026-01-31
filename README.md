# Wrestling Prediction System

A Next.js 16 application with secure authentication and a comprehensive wrestling prediction system, built for small-scale private use.

## Features

- 🔐 **Secure Authentication** - JWT-based sessions with bcrypt password hashing
- 👥 **Role-Based Access Control** - Admin and normal user permissions
- 🎯 **Match Predictions** - Predict winners for any match type (singles, tag, multi-team, battle royal)
- 🎲 **Custom Predictions** - Create custom prediction questions (time, count, wrestler, boolean, text)
- 🔄 **Contrarian Mode** - Try to get everything wrong and auto-win
- 📊 **Scoring System** - Automated scoring with leaderboards
- 🌐 **RESTful API** - ~70 endpoints with full CRUD operations
- 📱 **Auto-Refresh Ready** - API designed for real-time UI updates

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router
- **Runtime**: Bun
- **Database**: SQLite with Drizzle ORM (16 tables)
- **Authentication**: Auth.js (NextAuth v5)
- **UI**: shadcn/ui + Tailwind CSS 4
- **Language**: TypeScript

## Quick Start

```bash
# Install dependencies
bun install

# Run database migrations
bun db:migrate

# Seed initial data (brands, prediction templates)
bunx tsx scripts/seed-wrestling-data.ts

# Create your first admin user
bun db:create-user
# Answer 'y' to "Is Admin?"

# Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) and login with your created user.

## Project Structure

```
burberry/
├── app/
│   ├── api/              # ~70 RESTful API endpoints
│   ├── lib/              # API helpers, types, database
│   └── ...
├── docs/                 # 📚 Detailed documentation
│   ├── API.md           # Complete API reference
│   ├── ADMIN_PERMISSIONS_PLAN.md
│   └── ADMIN_IMPLEMENTATION_COMPLETE.md
├── scripts/              # Utility scripts
└── CLAUDE.md            # System architecture & design decisions
```

## Documentation

- **[docs/API.md](docs/API.md)** - Complete API reference with all endpoints
- **[CLAUDE.md](CLAUDE.md)** - System architecture and design decisions
- **[docs/README.md](docs/README.md)** - Documentation index and navigation guide

## Key Concepts

### User Roles

**Normal Users** can:
- View all data (brands, wrestlers, events, matches)
- Make and manage their own predictions
- View leaderboards and scores

**Admins** can:
- Everything normal users can do, PLUS:
- Create/update/delete all entities
- Enter match results
- Trigger event scoring
- Manage events (change status from open → locked → completed)

### Event Lifecycle

1. **Open** - Admin creates event, adds matches → Users make predictions
2. **Locked** - Event started, predictions closed → Admin enters results during event
3. **Completed** - Results finalized → Admin triggers scoring → Leaderboard available

### API Structure

All business logic is encapsulated in the RESTful API:
- **~70 total endpoints**
- **28 admin-only endpoints** (marked with `[ADMIN ONLY]` in docs)
- **Type-safe** with TypeScript throughout
- **Rate limited** (100 req/min default)

See [docs/API.md](docs/API.md) for complete reference.

## Common Tasks

### Create Admin User
```bash
bun db:create-user
# Email: admin@example.com
# Password: [your-password]
# Name: Admin User
# Is Admin? y
```

### Promote Existing User to Admin
```bash
sqlite3 data/database.db "UPDATE users SET isAdmin = 1 WHERE email = 'user@example.com';"
```

### View Database
```bash
bun db:studio
```

### Generate Migration (After Schema Changes)
```bash
bun db:generate  # Creates migration file
bun db:migrate   # Applies migration
```

## API Usage

### Frontend (Type-Safe Client)
```typescript
import { apiClient } from '@/app/lib/api-client';

// Get all brands
const brands = await apiClient.getBrands();

// Create brand (admin only)
const brand = await apiClient.createBrand({ name: 'WWE' });

// Make prediction
await apiClient.createMatchPrediction({
  matchId: 'match_123',
  predictedSide: 1
});
```

### Direct HTTP
```bash
# Get all events
GET /api/events

# Create event (admin only)
POST /api/events
{
  "name": "WrestleMania 40",
  "brandId": "brand_wwe",
  "eventDate": "2024-04-07T00:00:00.000Z",
  "status": "open"
}
```

## Security Features

- ✅ bcrypt password hashing (10 rounds)
- ✅ JWT sessions with HTTP-only cookies
- ✅ Rate limiting (5 login attempts/15min, 100 API req/min)
- ✅ Server-side session validation
- ✅ Role-based access control
- ✅ SQL injection protection (Drizzle ORM)
- ✅ CSRF protection (Auth.js)

## Database Schema

16 tables organized into:
- **User Management**: users
- **Core Data**: brands, wrestlers, wrestlerNames, tagTeams, tagTeamMembers, championships
- **Events & Matches**: events, matches, matchParticipants, matchCombatantChampionships
- **Predictions**: matchPredictions, customPredictionTemplates, eventCustomPredictions, userCustomPredictions, userEventContrarian

See [CLAUDE.md](CLAUDE.md) for detailed schema information.

## Contributing

This is a private system for small-scale use. For questions or issues, refer to:
- [docs/API.md](docs/API.md) for API details
- [CLAUDE.md](CLAUDE.md) for architecture decisions
- [docs/README.md](docs/README.md) for documentation navigation

## License

Private use only.

---

**Version**: 1.1
**Last Updated**: 2026-01-31
**Next.js**: 16.1.6
**API Endpoints**: ~70 (28 admin-only)
