# Code Review Standards — Wrestling Prediction System

> **Purpose:** Define a finite, repeatable rubric for AI-assisted code reviews
> of this Next.js 16 / React 19 application. Reviews check _only_ what is
> listed here. If an issue does not fall into a category below, it is out of
> scope and must not be flagged.

---

## How to Use This Document

When performing a code review, work through each section in order. For every
finding, assign exactly one severity from the table below. Do not invent new
severities or categories.

| Severity      | Meaning                                                                 | Action                                                    |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| **MUST FIX**  | Bugs, security issues, broken rendering, accessibility failures, data leaks to client | Block merge                                               |
| **SHOULD FIX**| Meaningful improvements to maintainability, idiom conformance, or component design     | Fix in this PR or create a tracked issue                  |
| **CONSIDER**  | Minor suggestions that are genuinely better but where the current code is acceptable   | Author's discretion — no follow-up required               |

Present findings as a structured list grouped by severity. Each finding must
reference a specific file and line range, state what the problem is, explain
_why_ it matters, and suggest a concrete fix.

---

## §1 · Server / Client Component Boundary

### MUST FIX

- **Secrets leaked to client components.** Environment variables without
  `NEXT_PUBLIC_` prefix, database connections, `AUTH_SECRET`, or any
  server-side value reaching a component without `'use client'` awareness.
  This includes passing Drizzle query results containing internal IDs or
  fields not intended for the client without sanitising.
- **Missing `'use client'` directive.** A component uses client-only APIs
  (`useState`, `useEffect`, `useReducer`, `useRef` for DOM, event handlers,
  browser APIs) but lacks the `'use client'` directive.
- **Missing `'use server'` directive.** A function intended as a Server Action
  (e.g. in `app/actions/`) is callable from a client component but lacks the
  `'use server'` directive.
- **Serialisation boundary violations.** Passing non-serialisable values
  (functions, class instances, Dates without conversion, Drizzle row objects
  with methods) from Server Components to Client Components as props.

### SHOULD FIX

- **Unnecessary `'use client'` directive.** A component that doesn't use any
  client-side hooks, event handlers, or browser APIs is marked `'use client'`,
  pushing it and its children into the client bundle.
- **Large client component trees.** A `'use client'` boundary placed too high
  in the component tree, pulling server-renderable subtrees into the client
  bundle. Push the boundary as low as possible — extract interactive parts
  (e.g. a Dialog trigger, a prediction form) into leaf client components.

---

## §2 · API Routes & Data Fetching

This project uses RESTful API routes (`app/api/`) for all business logic,
with `apiClient` on the frontend. Review both sides.

### MUST FIX

- **Missing auth check in API routes.** Any API route handler that performs
  mutations or returns user-specific data without verifying the session via
  Better Auth. All endpoints require authentication.
- **Missing admin check on admin-only endpoints.** Endpoints that create,
  update, or delete entities (brands, wrestlers, events, matches, results)
  must verify `role === 'admin'` server-side against the database, not just
  check a client-side flag.
- **Waterfall data fetching.** Sequential `await` calls in a Server Component
  or API route where the fetches are independent. Use `Promise.all`.
- **Missing error boundaries.** A data-fetching page or layout lacks a
  corresponding `error.tsx`, meaning failures crash the entire parent layout.
- **Raw SQL or string interpolation in queries.** All database access must go
  through Drizzle ORM's query builder with parameterised values. Never
  interpolate user input into `.sql` template literals.

### SHOULD FIX

- **Missing `loading.tsx` / Suspense boundaries.** Pages with async data
  fetching that show no visual feedback during loads. The project convention
  is skeleton placeholders.
- **Inconsistent error response format.** API routes should return the
  standard `{ error: "Message" }` format with appropriate HTTP status codes.
  Check that error responses don't leak stack traces or internal paths.
- **Missing pagination.** List endpoints that return unbounded result sets
  instead of using the project's standard pagination (20 default, 100 max).
- **Redundant client-side fetching.** Data that could be fetched in a Server
  Component is instead fetched client-side via `apiClient` in a `useEffect`,
  adding unnecessary roundtrips. Reserve client-side fetching for interactive
  updates (prediction submission, admin CRUD).
- **Missing request ID propagation.** API error responses should include the
  request ID for debugging correlation.

### CONSIDER

- **Cache-friendly read endpoints.** Frequently accessed, rarely changing data
  (brands, wrestler lists) that could benefit from `"use cache"` or
  route-level caching with `revalidateTag()` on mutation.

---

## §3 · Routing & File Conventions

### MUST FIX

- **Broken route segments.** A `page.tsx` missing from a route directory that
  should be accessible, or a layout/page in the wrong directory causing 404s.
- **Params not awaited.** Dynamic route `params` and `searchParams` are
  Promises in Next.js 15+ and must be awaited before access. Accessing
  `.slug` or `.id` directly without `await` silently returns `undefined`.
- **Route protection bypass.** The project uses `proxy.ts` for route
  protection middleware. Any new authenticated route must be covered by this
  middleware. Check that unauthenticated users cannot access protected pages.

### SHOULD FIX

- **Missing `not-found.tsx`.** Routes with dynamic segments (e.g.
  `/events/[id]`, `/wrestlers/[id]`) that could receive invalid IDs lack
  a `not-found.tsx` boundary.
- **Middleware doing too much.** Logic in `proxy.ts` that belongs in a
  layout, Server Action, or API route. Middleware should be limited to
  auth checks, redirects, and header manipulation.

---

## §4 · TypeScript & Type Safety

### MUST FIX

- **`any` used to silence errors.** Explicit `any` or `as any` casts that
  mask type errors. Exceptions: third-party library gaps with a `// TODO:`
  comment.
- **Missing return types on Server Actions.** Server Actions in
  `app/actions/` should have explicit return types for serialisation clarity.

### SHOULD FIX

- **Loose prop types.** Component props typed as `Record<string, unknown>`,
  bare `object`, or overly permissive unions where a specific interface would
  catch misuse.
- **Unvalidated API request bodies.** Request data consumed in API routes
  without running through the project's Zod validation schemas
  (`validation-schemas.ts`). All input must be validated at the boundary.
- **Type duplication.** Types defined locally that duplicate or diverge from
  the canonical types in `api-types.ts`. Use the shared types.
- **Missing `satisfies` for config objects.** Route segment configs or
  metadata exports that would benefit from `satisfies` for typo prevention.

---

## §5 · Component Design & React Patterns

### MUST FIX

- **Hooks called conditionally.** Any hook called inside a conditional, loop,
  or after an early return.
- **Missing dependency array entries.** `useEffect`, `useCallback`, or
  `useMemo` with stale closure bugs due to omitted dependencies.
- **Infinite re-render loops.** State updates inside `useEffect` without
  proper guards, or derived state computed in effects instead of inline.

### SHOULD FIX

- **Prop drilling beyond 2 levels.** Props threaded through multiple
  intermediate components that don't use them.
- **God components.** Components exceeding ~200 lines that mix data fetching,
  business logic, and presentation. Split into focused units.
- **Inconsistent state management pattern.** The project convention is
  `useState` for UI state and `apiClient` for data. Deviations (e.g.
  useReducer for simple boolean state, fetching outside apiClient) should
  be flagged unless justified.
- **Class components in new code.** React 19 is function-component-first.

### CONSIDER

- **Compound components.** Complex UI patterns (e.g. prediction forms with
  multiple match types) that could benefit from compound component or slot
  patterns for flexibility.

---

## §6 · Accessibility (a11y)

### MUST FIX

- **Interactive elements without accessible names.** Buttons, links, or form
  controls lacking visible text, `aria-label`, or `aria-labelledby`.
- **Images without `alt` attributes.** All `<Image>` and `<img>` elements
  must have `alt`. Decorative images use `alt=""`.
- **Non-interactive elements with click handlers.** `<div onClick>` or
  `<span onClick>` without `role`, `tabIndex`, and keyboard handlers. Use
  `<button>` or `<a>` instead.
- **Missing form labels.** `<input>`, `<select>`, or `<textarea>` elements
  without an associated `<label>`. Especially relevant for prediction forms
  and admin CRUD dialogs.

### SHOULD FIX

- **Focus management in dialogs.** The project uses Dialog and AlertDialog
  from shadcn/ui. Ensure focus is trapped correctly and returned to the
  trigger on close.
- **Missing skip navigation link.** The root layout should have a "Skip to
  main content" link as the first focusable element.
- **ARIA misuse.** Incorrect `role` values, redundant ARIA on semantic HTML,
  or `aria-hidden="true"` on focusable elements.
- **Data tables without proper markup.** Tables displaying wrestlers, events,
  or predictions must use `<thead>`, `<th scope>`, and proper caption or
  `aria-label` for screen reader context.

---

## §7 · Performance

### MUST FIX

- **Blocking the main thread.** Synchronous heavy computation in client
  component render paths (e.g. sorting/filtering large prediction datasets
  without memoisation or deferral).

### SHOULD FIX

- **Missing dynamic imports for heavy client libraries.** Large packages
  imported at the top level of client components instead of `next/dynamic`
  or `React.lazy`.
- **Unoptimised images.** Raw `<img>` tags instead of `next/image`, or
  `<Image>` without `width`/`height` or `sizes`.
- **Missing `next/font`.** Fonts loaded via `<link>` or CSS `@import`
  instead of `next/font`.
- **Bundle size regressions.** Importing entire utility libraries instead of
  specific modules, or shipping server-only code (Drizzle, database helpers)
  into the client bundle.

### CONSIDER

- **SSE connection efficiency.** Verify SSE connections are cleaned up on
  unmount and per-user limits are enforced to prevent resource exhaustion.

---

## §8 · Security

### MUST FIX

- **Unvalidated input in API routes / Server Actions.** Form data, search
  params, or request bodies consumed without Zod validation. Use the schemas
  in `validation-schemas.ts`. Never trust client input.
- **SQL injection.** Any database query that does not use Drizzle's
  parameterised query builder. Watch for raw `.sql` template usage with
  interpolated user values.
- **XSS vectors.** Use of `dangerouslySetInnerHTML` without DOMPurify
  sanitisation. Also flag any pattern that renders user-supplied strings
  as HTML.
- **Privilege escalation.** Admin-only operations that check role on the
  client or from a cached/stale session instead of verifying against the
  database on each request.
- **Session handling gaps.** Mutations that don't verify the session is still
  valid. Better Auth handles this, but custom session checks must use the
  database-backed session, not just the cookie.

### SHOULD FIX

- **Sensitive data in client-side logs.** `console.log` in client components
  that outputs user PII, session tokens, or internal IDs.
- **Missing HTTPS enforcement in production config.** Cookie flags (`Secure`,
  `HttpOnly`, `SameSite`) must be correct for production. Verify Better Auth
  config accounts for this.
- **Overly permissive CORS.** This is a private system — CORS should be
  scoped to the deployment domain, not `*`.

---

## §9 · Error Handling & Resilience

### MUST FIX

- **Unhandled promise rejections.** Async operations in Server Components,
  Server Actions, API routes, or `useEffect` that lack try/catch or `.catch()`.
- **Swallowed errors.** Empty catch blocks or catches that only log without
  returning an error state or notifying the user.

### SHOULD FIX

- **Missing `error.tsx` boundaries.** Route segments with data fetching but
  no `error.tsx`. Project convention: error cards with retry buttons.
- **Generic error messages.** User-facing errors exposing stack traces, file
  paths, or database errors. Use the standardised messages from
  `api-errors.ts`.
- **Prediction lifecycle edge cases.** Ensure event state transitions
  (open → locked → completed) are validated server-side and users get clear
  feedback when attempting invalid actions (e.g. predictions after lock).

---

## §10 · Testing

### SHOULD FIX

- **No tests for critical API routes / Server Actions.** Mutation endpoints
  (create/update/delete, submit predictions, score events) need at least
  one happy-path and one error-path test.
- **No tests for auth flows.** Login, session validation, and role-based
  access control should have integration tests.
- **No tests for scoring logic.** Prediction scoring (including contrarian
  mode) is core business logic and must be tested.

### CONSIDER

- **E2E tests for the prediction lifecycle.** The full flow (create event →
  add matches → predictions → lock → results → score) is the critical path
  and benefits from end-to-end coverage.

---

## §11 · Code Organisation & Conventions

### SHOULD FIX

- **Inconsistent file naming.** Deviations from the project's established
  naming conventions within the same directory.
- **Co-location violations.** Utilities, types, or constants in a global
  location when only used by a single route or feature.
- **Barrel file abuse.** `index.ts` re-exports creating circular dependency
  risks, especially in `app/`.
- **Hardcoded strings.** URLs, magic numbers, or config values scattered
  through components instead of constants or environment variables.
- **Deviation from UI patterns.** New code that doesn't follow documented
  conventions: SiteHeader with breadcrumbs → content area, Card with
  `py-0 overflow-hidden` → Table for data tables, Dialog for create/edit,
  AlertDialog for delete.

### CONSIDER

- **Feature-based grouping.** If the component directory grows unwieldy,
  suggest grouping by feature domain (predictions, events, admin).

---

## Out of Scope — Do NOT Flag

- **Rewriting working components** to an equivalent pattern.
- **Speculative abstractions** ("what if you need X later").
- **Suggesting OAuth or alternative auth.** Credentials-only is by design.
- **Suggesting a different database.** SQLite + Drizzle is the chosen stack.
- **Suggesting additional rate limiting on prediction endpoints.** Documented
  architecture decision — auth required, private system, upsert prevents
  duplicates.
- **Recommending state management libraries.** `useState` + `apiClient` is
  the convention.
- **Aesthetic preferences** — these belong in linter config.
- **Suggesting framework migration.**

---

## Convergence Rule

A codebase that satisfies all MUST FIX and SHOULD FIX criteria in this
document, passes its linter suite (`eslint` with `next/core-web-vitals`,
`tsc --noEmit`), and has reasonable test coverage for critical flows
(auth, predictions, scoring) is **review-complete**. Subsequent review
passes that surface only CONSIDER-level or out-of-scope items are a signal
to stop reviewing and ship.
