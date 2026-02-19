# Test Coverage Plan

**Current Status**: ~10% coverage (4 test files for 39 API routes)
**Target**: 80%+ coverage with focus on critical paths

## Test Infrastructure

**Framework**: Bun test (built-in)
**Database**: In-memory SQLite for tests
**Helpers**: `tests/helpers/db.ts` and `tests/helpers/fixtures.ts`

## Priority 1: Critical Business Logic (HIGH IMPACT)

### Scoring & Results System
**Impact**: Revenue/competitive integrity
**Files**:
- `app/lib/services/event.service.ts` (scoring logic)
- `app/api/events/[id]/score/route.ts`

**Test Cases**:
- ✅ Basic match prediction scoring (exists in `prediction.service.test.ts`)
- ✅ Custom prediction scoring (exists in `prediction.service.test.ts`)
- ✅ Contrarian mode - all wrong = win (exists in `prediction.service.test.ts`)
- ❌ **MISSING**: Contrarian mode - mixed results
- ❌ **MISSING**: Partial scoring (some matches without results)
- ❌ **MISSING**: Edge case: No predictions made
- ❌ **MISSING**: Edge case: All draws/no-contests
- ❌ **MISSING**: Rescore all events (admin endpoint)

**New Test File**: `tests/services/scoring.service.test.ts`
```typescript
describe('Event Scoring System', () => {
  describe('Match Prediction Scoring', () => {
    test('correctly scores team match predictions')
    test('correctly scores free-for-all predictions')
    test('handles partial results (some matches unscored)')
    test('scores draws as incorrect predictions')
  })

  describe('Custom Prediction Scoring', () => {
    test('scores time-based predictions (within tolerance)')
    test('scores count-based predictions (exact match)')
    test('scores wrestler-based predictions')
    test('scores boolean predictions')
    test('scores text predictions (exact match)')
  })

  describe('Contrarian Mode', () => {
    test('user wins if ALL match predictions wrong')
    test('user loses if ANY match prediction correct')
    test('ignores custom predictions for contrarian')
    test('contrarian winner beats highest normal score')
  })

  describe('Leaderboard Calculation', () => {
    test('sorts contrarian winners first')
    test('then sorts by total score descending')
    test('handles ties correctly')
    test('includes only participants who joined event')
  })
})
```

---

## Priority 2: API Integration Tests (MEDIUM IMPACT)

### Authentication & Authorization
**Impact**: Security critical
**Files**: API routes + `app/lib/api-helpers.ts`

**Test Cases**:
- ❌ **MISSING**: Unauthenticated requests return 401
- ❌ **MISSING**: Non-admin users blocked from admin endpoints (403)
- ❌ **MISSING**: Admin status checked against database (not just session)
- ❌ **MISSING**: Session expiry handling
- ❌ **MISSING**: Rate limiting (Better Auth)

**New Test File**: `tests/api/auth.test.ts`

### Event Lifecycle Management
**Impact**: Core workflow
**Files**: Event API routes

**Test Cases**:
- ✅ Create event (exists)
- ❌ **MISSING**: Status transitions (open → locked → completed)
- ❌ **MISSING**: Reject invalid state transitions (locked → open)
- ❌ **MISSING**: Prevent prediction changes when locked
- ❌ **MISSING**: Join event (normal vs contrarian)
- ❌ **MISSING**: Cannot join after event locked
- ❌ **MISSING**: Cannot change mode after joining

**New Test File**: `tests/api/events.test.ts`

### Prediction Submission & Validation
**Impact**: User-facing, high frequency
**Files**: Prediction API routes + services

**Test Cases**:
- ✅ Create/update match prediction (exists)
- ❌ **MISSING**: Concurrent submission handling (upsert logic)
- ❌ **MISSING**: Prevent predictions when event locked
- ❌ **MISSING**: Validate side exists for team matches
- ❌ **MISSING**: Validate participant exists for free-for-all
- ❌ **MISSING**: Custom prediction type validation
- ❌ **MISSING**: Contrarian mode blocks regular scoring

**New Test File**: `tests/api/predictions.test.ts`

---

## Priority 3: Real-Time Features (MEDIUM IMPACT)

### Server-Sent Events (SSE)
**Impact**: Live event experience
**Files**: `app/api/events/[id]/live/route.ts`

**Test Cases**:
- ❌ **MISSING**: SSE connection established
- ❌ **MISSING**: Keep-alive pings sent every 30s
- ❌ **MISSING**: Event updates pushed to clients
- ❌ **MISSING**: Match changes detected and pushed
- ❌ **MISSING**: Participant changes detected
- ❌ **MISSING**: Prediction changes detected
- ❌ **MISSING**: Connection timeout after 1 hour
- ❌ **MISSING**: Graceful reconnection handling

**New Test File**: `tests/api/sse.test.ts`
**Challenge**: Bun test doesn't natively support SSE testing. Consider:
- Manual fetch + ReadableStream parsing
- Or mark as manual QA only

---

## Priority 4: Data Integrity & Edge Cases (LOW-MEDIUM IMPACT)

### Match & Participant Management
**Files**: Match API routes + services

**Test Cases**:
- ❌ **MISSING**: Create match with participants (atomic)
- ❌ **MISSING**: Add/remove participants
- ❌ **MISSING**: Reorder matches
- ❌ **MISSING**: Prevent deletion when predictions exist
- ❌ **MISSING**: Validate champion flag logic

**New Test File**: `tests/api/matches.test.ts`

### Settings System
**Files**: Settings API routes + `app/lib/settings-utils.ts`

**Test Cases**:
- ❌ **MISSING**: Get setting with default fallback
- ❌ **MISSING**: Create/update setting
- ❌ **MISSING**: Type validation (boolean, number, json)
- ❌ **MISSING**: JSON schema validation
- ❌ **MISSING**: Delete setting

**New Test File**: `tests/api/settings.test.ts`

---

## Priority 5: End-to-End Workflows (LOW IMPACT)

These test entire user workflows from start to finish.

### Complete Event Workflow
**Test File**: `tests/e2e/event-workflow.test.ts`

**Scenario**:
1. Admin creates event
2. Admin adds matches with participants
3. Admin adds custom predictions
4. Users join event (normal + contrarian)
5. Users make predictions
6. Admin locks event
7. Admin enters results
8. Admin completes event
9. Admin scores event
10. Verify leaderboard correctness

### Concurrent Prediction Submission
**Test File**: `tests/e2e/concurrent-predictions.test.ts`

**Scenario**:
- Multiple users submit predictions for same match simultaneously
- Verify all predictions saved correctly (no race conditions)
- Verify stats endpoint shows accurate counts

---

## Implementation Strategy

### Phase 1: Critical Path (Week 1) - ~16 hours
1. **Scoring tests** (`scoring.service.test.ts`) - 4 hours
2. **Auth tests** (`auth.test.ts`) - 3 hours
3. **Event lifecycle tests** (`events.test.ts`) - 5 hours
4. **Prediction validation tests** (`predictions.test.ts`) - 4 hours

### Phase 2: API Coverage (Week 2) - ~12 hours
5. **Match management** (`matches.test.ts`) - 4 hours
6. **Settings tests** (`settings.test.ts`) - 2 hours
7. **Dashboard/Leaderboard tests** (`leaderboard.test.ts`) - 3 hours
8. **Admin tools tests** (`admin.test.ts`) - 3 hours

### Phase 3: Edge Cases (Week 3) - ~8 hours
9. **SSE tests** (`sse.test.ts`) - 4 hours (or skip if too complex)
10. **E2E workflow test** (`event-workflow.test.ts`) - 4 hours

### Phase 4: Maintenance (Ongoing)
- Add tests for new features as they're built
- Update tests when bugs are fixed
- Monitor coverage with `bun test --coverage` (if available)

---

## Test File Template

```typescript
/**
 * Tests for [Feature Name]
 * Coverage: [list endpoints/functions tested]
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { setupTestDb, clearTestDb, closeTestDb, getTestDb } from '../helpers/db';
import { createBrand, createEvent, createUser } from '../helpers/fixtures';

describe('[Feature Name]', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe('[Sub-feature]', () => {
    test('should [expected behavior]', async () => {
      // Arrange
      const user = await createUser();

      // Act
      const result = await someFunction(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe('success');
    });

    test('should reject invalid input', async () => {
      // Arrange
      const invalidData = { bad: 'data' };

      // Act & Assert
      expect(async () => {
        await someFunction(invalidData);
      }).toThrow('Validation error');
    });
  });
});
```

---

## Coverage Goals

| Category | Current | Target | Priority |
|----------|---------|--------|----------|
| Services | 50% | 90% | HIGH |
| API Routes | 5% | 80% | HIGH |
| Utils/Helpers | 30% | 85% | MEDIUM |
| UI Components | 0% | 60% | LOW |
| E2E Workflows | 0% | 20% | LOW |
| **Overall** | **10%** | **80%** | - |

---

## Testing Best Practices

1. **Isolation**: Each test should be independent (use `beforeEach` to reset DB)
2. **AAA Pattern**: Arrange, Act, Assert
3. **Descriptive Names**: `test('should reject predictions when event is locked')`
4. **Edge Cases**: Always test boundary conditions, null values, empty arrays
5. **Error Paths**: Test both success and failure scenarios
6. **Data Cleanup**: Use `afterAll` to close DB connections
7. **Fast Execution**: Keep tests under 50ms each (use in-memory DB)
8. **No Flakiness**: Avoid time-dependent assertions (use mocks for dates)

---

## Tools & Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/services/scoring.service.test.ts

# Run tests matching pattern
bun test --grep "Contrarian"

# Watch mode (rerun on file changes)
bun test --watch

# Coverage report (if supported)
bun test --coverage
```

---

## Risk Assessment

### High Risk (Must Test)
- ✅ Scoring algorithm correctness
- ✅ Auth/authorization enforcement
- ✅ Data integrity (predictions, results)
- ✅ State transition validation

### Medium Risk (Should Test)
- ✅ API input validation
- ✅ Concurrent operations
- ⚠️ SSE real-time updates
- ✅ Settings management

### Low Risk (Nice to Test)
- ❌ UI component rendering
- ❌ Styling/layout
- ❌ Client-side state management

---

**Last Updated**: 2026-02-07
