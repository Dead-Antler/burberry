# Settings System

The application uses a key-value settings system for runtime configuration. Settings are stored in the `settings` table and validated using Zod schemas.

## Architecture

```
settings table (SQLite)
    └── key (unique, namespaced)
    └── scope (global)
    └── type (string | boolean | number | json)
    └── value (serialized string)

app/lib/
    settings-schemas.ts   # Type definitions, Zod schemas
    settings-utils.ts     # Helper functions (e.g., isSignupEnabled)
    services/settings.service.ts  # CRUD operations
```

## Setting Types

| Type | Storage | Example |
|------|---------|---------|
| `string` | Plain text | `"hello"` |
| `boolean` | `"true"` / `"false"` | `true` |
| `number` | Numeric string | `42` |
| `json` | JSON string | `["a", "b"]` |

## Known Settings

### Authentication

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `auth.signupEnabled` | boolean | `false` | Allow new user registration |

## Adding New Settings

### 1. Simple Settings (string, boolean, number)

Add to `simpleSettingDefinitions` in `settings-schemas.ts`:

```typescript
export const simpleSettingDefinitions = {
  'auth.signupEnabled': { type: 'boolean', default: false },
  'app.maintenanceMode': { type: 'boolean', default: false }, // New
} as const;
```

### 2. JSON Settings (complex objects/arrays)

Add a Zod schema to `jsonSettingSchemas` in `settings-schemas.ts`:

```typescript
export const jsonSettingSchemas = {
  'scoring.rules': z.object({
    correctPrediction: z.number().min(0),
    bonusMultiplier: z.number().min(1),
  }),
} as const;
```

## Usage

### In Server Code

```typescript
import { settingsService } from '@/app/lib/services/settings.service';

// Get a simple setting
const signupEnabled = await settingsService.getSimple('auth.signupEnabled');

// Set a setting
await settingsService.setSimple('auth.signupEnabled', true);
```

### Direct Access (Avoiding Circular Dependencies)

For settings needed in auth configuration, use direct DB access via `settings-utils.ts`:

```typescript
import { isSignupEnabled } from '@/app/lib/settings-utils';

const enabled = await isSignupEnabled();
```

## API Access

All settings endpoints require admin authentication.

```bash
# List all settings
GET /api/settings

# List settings by namespace
GET /api/settings?namespace=auth

# Get single setting
GET /api/settings/auth.signupEnabled

# Create/update setting
POST /api/settings
{
  "key": "auth.signupEnabled",
  "type": "boolean",
  "value": true
}

# Delete setting
DELETE /api/settings/auth.signupEnabled
```

## Naming Conventions

Settings use dot-notation namespacing:

- `auth.*` - Authentication settings
- `predictions.*` - Prediction system settings
- `scoring.*` - Scoring rules (future)
- `ui.*` - UI preferences (future)

---

**Last Updated:** 2026-02-03
