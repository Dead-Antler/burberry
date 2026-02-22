# Wrestling Prediction System

A Next.js 16 application with secure authentication and a comprehensive wrestling prediction system, built for small-scale private use.

## Features

- **Secure Authentication** - Database-backed sessions with Scrypt password hashing
- **Role-Based Access Control** - Admin and normal user permissions
- **Match Predictions** - Predict winners for any match type (singles, tag, multi-team, battle royal)
- **Custom Predictions** - Create custom prediction questions (time, count, wrestler, boolean, text)
- **Contrarian Mode** - Try to get everything wrong and auto-win
- **Scoring System** - Automated scoring with leaderboards
- **RESTful API** - ~70 endpoints with full CRUD operations

## Tech Stack

- **Framework**: Next.js 16.1.6 with App Router
- **Runtime**: Bun
- **Database**: SQLite with Drizzle ORM
- **Authentication**: Better Auth v1.4 (credentials, database sessions)
- **UI**: shadcn/ui + Tailwind CSS 4
- **Language**: TypeScript

## Quick Start (Local Development)

```bash
# Install dependencies
bun install

# Copy environment file and fill in values
cp .env.example .env
# Edit .env — at minimum, generate AUTH_SECRET:
#   openssl rand -base64 32

# Run database migrations
bun db:migrate

# Seed initial data — optional, creates brands and prediction templates
bun db:seed

# Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000). On first startup with an empty database, an admin account is created automatically if `ADMIN_EMAIL` is set — the credentials are printed to the console.

## Running with Docker

### Docker Compose (recommended)

```bash
# Set required secrets
export AUTH_SECRET=$(openssl rand -base64 32)

# Start the container
docker compose up -d

# View logs (admin credentials are printed on first run)
docker compose logs -f
```

See [docker-compose.yml](docker-compose.yml) for the full configuration.

### Docker Run

```bash
docker run -d \
  --name burberry \
  -p 3000:3000 \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  -e DB_FILE_NAME=file:data/database.db \
  -e AUTH_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@example.com \
  -v burberry-data:/app/data \
  ghcr.io/dead-antler/burberry:latest
```

### Building the image locally

```bash
bun run docker:build
```

Database migrations run automatically on container startup. The SQLite database is stored in the `/app/data` volume, so it persists across container restarts and image upgrades.

Utility scripts are available inside the container:

```bash
docker exec burberry bun scripts/seed.ts    # Seed initial data
docker exec burberry bun scripts/reset.ts   # Reset data (preserves users)
```

## Environment Variables

| Variable         | Required | Default    | Description                                                                          |
| ---------------- | -------- | ---------- | ------------------------------------------------------------------------------------ |
| `DB_FILE_NAME`   | Yes      | —          | SQLite connection string, e.g. `file:data/database.db`                               |
| `AUTH_SECRET`    | Yes      | —          | Session signing secret, min 32 chars. Generate: `openssl rand -base64 32`            |
| `AUTH_URL`       | Yes      | —          | Public URL of the application, e.g. `http://localhost:3000`                          |
| `ADMIN_EMAIL`    | No       | —          | Email for auto-created admin account on first startup                                |
| `ADMIN_PASSWORD` | No       | _(random)_ | Admin password. If unset, randomly generated and printed to console on first startup |
| `DB_LOGGING`     | No       | `false`    | Enable Drizzle ORM query logging                                                     |
| `PUID`           | No       | `1001`     | User ID for the container process (Docker only)                                      |
| `PGID`           | No       | `1001`     | Group ID for the container process (Docker only)                                     |

See [.env.example](.env.example) for a copyable template with comments.

## Development

```bash
bun dev                    # Start dev server
bun db:generate            # Generate migration from schema changes
bun db:migrate             # Apply migrations
bun db:validate            # Validate migration files for common issues
bun db:seed                # Seed initial data (brands, prediction templates)
bun db:studio              # Browse database
bun test                   # Run tests
bun run build              # Production build
bun run docker:build       # Build Docker image locally
```

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
- Manage events (change status from open -> locked -> completed)

### Event Lifecycle

1. **Open** - Admin creates event, adds matches. Users make predictions.
2. **Locked** - Event started, predictions closed. Admin enters results during event.
3. **Completed** - Results finalized. Admin triggers scoring. Leaderboard available.

## Common Tasks

### Promote Existing User to Admin

```bash
sqlite3 data/database.db "UPDATE users SET role = 'admin' WHERE email = 'user@example.com';"
```

### View Database

```bash
bun db:studio
```

## Documentation

- **[docs/API.md](docs/API.md)** - Complete API reference (~70 endpoints)
- **[docs/UI.md](docs/UI.md)** - UI patterns and component guidelines
- **[CLAUDE.md](CLAUDE.md)** - System architecture and design decisions

## License

Private use only.
