/**
 * Event Status Utilities
 * Shared logic for event status transitions and validation
 */

export type EventStatus = 'upcoming' | 'open' | 'locked' | 'completed';

/**
 * Valid status transitions for events
 * - upcoming -> open (when predictions open)
 * - open -> locked (when event starts)
 * - locked -> completed (when results are entered)
 */
export const VALID_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  upcoming: ['open'],
  open: ['locked'],
  locked: ['completed'],
  completed: [],
};

/**
 * Check if a status transition is valid
 */
export function isValidStatusTransition(from: EventStatus, to: EventStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get the next valid status for an event
 * Returns null if event cannot transition further
 */
export function getNextStatus(current: EventStatus): EventStatus | null {
  const transitions = VALID_STATUS_TRANSITIONS[current];
  return transitions.length > 0 ? transitions[0] : null;
}

/**
 * Check if an event status allows editing (matches, participants)
 */
export function isEditableStatus(status: EventStatus): boolean {
  return status === 'upcoming' || status === 'open';
}

/**
 * Human-readable status descriptions
 */
export const STATUS_DESCRIPTIONS: Record<EventStatus, string> = {
  upcoming: 'Predictions not yet open',
  open: 'Accepting predictions',
  locked: 'Predictions closed, awaiting results',
  completed: 'Results entered and scored',
};
