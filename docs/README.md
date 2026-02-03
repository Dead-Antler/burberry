# Documentation

## API Reference

**[API.md](API.md)** - Complete RESTful API documentation

- All ~70 endpoints with request/response examples
- Authentication and authorization requirements
- Permission matrix (user vs admin endpoints)
- Pagination, filtering, and sorting parameters
- Error codes and rate limiting

## Settings

**[Settings.md](Settings.md)** - Application settings system

- Key-value configuration store
- Type-safe access with Zod validation
- Adding new settings

## UI Guidelines

**[UI.md](UI.md)** - Frontend patterns and conventions

## Related Files

| File | Description |
|------|-------------|
| `../CLAUDE.md` | System architecture overview |
| `../app/lib/schema.ts` | Database schema (15 tables) |
| `../app/lib/api-types.ts` | TypeScript type definitions |
| `../app/lib/api-client.ts` | Type-safe frontend client |
| `../app/lib/validation-schemas.ts` | Request validation schemas |
| `../app/lib/settings-schemas.ts` | Settings type definitions |
