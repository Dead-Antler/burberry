# Documentation

This directory contains detailed documentation for the wrestling prediction system.

## Documentation Files

### [API.md](API.md)
**Complete RESTful API Reference**

Comprehensive documentation of all ~70 API endpoints including:
- Authentication and authorization requirements
- Request/response examples for all endpoints
- Permission requirements (user vs admin)
- Event workflow examples
- Error codes and responses
- Auto-refresh compatibility notes

Use this when:
- Building the frontend UI
- Understanding endpoint behavior
- Checking permission requirements
- Learning the API request/response formats

### [ADMIN_PERMISSIONS_PLAN.md](ADMIN_PERMISSIONS_PLAN.md)
**Admin Permissions Implementation Plan**

Detailed plan for the role-based access control (RBAC) system including:
- Permission model design (Normal Users vs Admins)
- Implementation steps (8 detailed steps)
- Database schema changes
- Authentication flow updates
- API endpoint protection strategy
- Security considerations
- Migration path for existing data
- Testing checklist

Use this when:
- Understanding the permission system design
- Learning about admin vs user capabilities
- Implementing similar permission systems
- Troubleshooting permission issues

### [ADMIN_IMPLEMENTATION_COMPLETE.md](ADMIN_IMPLEMENTATION_COMPLETE.md)
**Implementation Completion Summary**

Summary of the completed admin permissions implementation including:
- What was implemented (checklist)
- Files modified (40+ files)
- Testing checklist
- Permission matrix
- Security features
- Usage examples
- Error responses
- Future enhancement ideas

Use this when:
- Verifying implementation completeness
- Testing the permission system
- Creating admin users
- Understanding the final state of the system

## Quick Navigation

### For Frontend Developers
1. Start with [API.md](API.md) to understand available endpoints
2. Use `app/lib/api-client.ts` for type-safe API calls
3. Reference `app/lib/api-types.ts` for TypeScript types

### For System Administrators
1. Read [ADMIN_IMPLEMENTATION_COMPLETE.md](ADMIN_IMPLEMENTATION_COMPLETE.md) for admin setup
2. Use `bun db:create-user` to create admin users
3. Refer to [API.md](API.md) for admin-only endpoints (marked with `[ADMIN ONLY]`)

### For Understanding the System
1. Read `../CLAUDE.md` for overall system architecture
2. Review [ADMIN_PERMISSIONS_PLAN.md](ADMIN_PERMISSIONS_PLAN.md) for RBAC design
3. Check [API.md](API.md) for complete API details

## Related Documentation

- **../CLAUDE.md** - System architecture, design decisions, and configuration
- **../README.md** - Project overview and quick start guide
- **app/lib/schema.ts** - Database schema (16 tables)
- **app/lib/api-types.ts** - TypeScript type definitions
- **app/lib/api-client.ts** - Frontend API client

## Documentation Standards

When adding new documentation to this directory:

1. **Use Markdown** - All documentation should be in `.md` format
2. **Be Comprehensive** - Include examples, code snippets, and usage notes
3. **Keep Updated** - Update docs when making changes to the system
4. **Cross-Reference** - Link to related documentation files
5. **User-Focused** - Write for different audiences (developers, admins, etc.)

---

**Last Updated**: 2026-01-31
**Documentation Version**: 1.0
