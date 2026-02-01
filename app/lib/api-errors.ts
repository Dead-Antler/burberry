/**
 * Standardized API error messages
 * Use these constants for consistent error reporting across the application
 */

// Entity not found errors
export const API_ERRORS = {
  // Authentication & Authorization
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Forbidden - Admin access required',
  INVALID_CREDENTIALS: 'Invalid email or password',

  // Entity not found (404)
  BRAND_NOT_FOUND: 'Brand not found',
  WRESTLER_NOT_FOUND: 'Wrestler not found',
  WRESTLER_NAME_NOT_FOUND: 'Wrestler name record not found',
  GROUP_NOT_FOUND: 'Group not found',
  GROUP_MEMBER_NOT_FOUND: 'Group member not found',
  EVENT_NOT_FOUND: 'Event not found',
  MATCH_NOT_FOUND: 'Match not found',
  MATCH_PARTICIPANT_NOT_FOUND: 'Match participant not found',
  PREDICTION_NOT_FOUND: 'Prediction not found',
  CUSTOM_PREDICTION_NOT_FOUND: 'Custom prediction not found',
  TEMPLATE_NOT_FOUND: 'Custom prediction template not found',

  // Validation errors (400)
  INVALID_JSON: 'Request body must be valid JSON',
  MISSING_FIELDS: (fields: string[]) => `Missing required fields: ${fields.join(', ')}`,
  INVALID_EVENT_STATUS: 'Invalid event status. Must be: open, locked, or completed',
  INVALID_MATCH_TYPE: 'Invalid match type',
  INVALID_PARTICIPANT_TYPE: 'Invalid participant type. Must be: wrestler or group',
  INVALID_PREDICTION_TYPE: 'Invalid prediction type',

  // Business logic errors (400)
  EVENT_LOCKED: 'Cannot modify a locked or completed event',
  EVENT_NOT_LOCKED: 'Event must be locked before scoring',
  EVENT_NOT_COMPLETED: 'Event must be completed to view scores',
  PREDICTIONS_LOCKED: 'Cannot modify predictions for a locked event',
  MIN_PARTICIPANTS: (min: number) => `At least ${min} participants required`,
  DUPLICATE_PREDICTION: 'Prediction already exists for this match',
  INVALID_CONTRARIAN: 'Cannot enable contrarian mode after making predictions',

  // Rate limiting (429)
  RATE_LIMIT: (retryAfter: number) => `Too many requests. Please try again in ${retryAfter} seconds`,

  // Server errors (500)
  INTERNAL_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database error occurred',
  CAPACITY_EXCEEDED: 'Rate limiter capacity exceeded. Please try again later',
} as const;

/**
 * Helper to get error message from API_ERRORS constant
 * Handles both string constants and function-based messages
 */
export function getErrorMessage(
  error: keyof typeof API_ERRORS | string,
  ...args: unknown[]
): string {
  if (typeof error === 'string' && error in API_ERRORS) {
    const message = API_ERRORS[error as keyof typeof API_ERRORS];
    if (typeof message === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (message as any)(...args);
    }
    return message;
  }
  return error;
}
