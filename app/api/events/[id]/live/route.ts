import { NextRequest } from 'next/server';
import { requireAuth, apiError } from '@/app/lib/api-helpers';
import { db } from '@/app/lib/db';
import { events, matches, userEventJoin, matchPredictions, matchParticipants } from '@/app/lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Per-user SSE connection limit
const SSE_MAX_CONNECTIONS_PER_USER = 3;

// Track active connections: userId -> Map<connectionId, controller>
const activeConnections = new Map<string, Map<string, ReadableStreamDefaultController>>();

function trackConnection(userId: string, connectionId: string, controller: ReadableStreamDefaultController) {
  let userConns = activeConnections.get(userId);
  if (!userConns) {
    userConns = new Map();
    activeConnections.set(userId, userConns);
  }

  // If at limit, close the oldest connection
  if (userConns.size >= SSE_MAX_CONNECTIONS_PER_USER) {
    const oldestId = userConns.keys().next().value!;
    const oldestController = userConns.get(oldestId);
    userConns.delete(oldestId);
    try {
      oldestController?.close();
    } catch {
      // Controller may already be closed
    }
  }

  userConns.set(connectionId, controller);
}

function untrackConnection(userId: string, connectionId: string) {
  const userConns = activeConnections.get(userId);
  if (userConns) {
    userConns.delete(connectionId);
    if (userConns.size === 0) {
      activeConnections.delete(userId);
    }
  }
}

/**
 * GET /api/events/:id/live
 * Server-Sent Events endpoint for real-time event updates
 *
 * Streams updates for:
 * - New matches added to the event
 * - New participants joining
 * - New predictions made
 * - Match results entered
 * - Event status changes
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Require authentication
  const session = await requireAuth(req);
  const userId = session.user.id;
  const connectionId = randomUUID();

  const { id: eventId } = await context.params;

  // Verify event exists
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return apiError('Event not found', 404);
  }

  // Create SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Register this connection (closes oldest if at limit)
      trackConnection(userId, connectionId, controller);

      // SSE Configuration constants
      const SSE_KEEPALIVE_INTERVAL_MS = 30_000; // 30 seconds
      const SSE_POLL_INTERVAL_MS = 2_000; // 2 seconds
      const SSE_MAX_CONNECTION_DURATION_MS = 60 * 60 * 1000; // 1 hour

      // Helper to send SSE message
      const sendEvent = (data: Record<string, unknown>, event?: string) => {
        const message = `${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send initial connection message
      sendEvent({ type: 'connected', eventId, timestamp: Date.now() });

      // Keep-alive interval to prevent connection timeout
      const keepAliveInterval = setInterval(() => {
        sendEvent({ type: 'ping', timestamp: Date.now() }, 'ping');
      }, SSE_KEEPALIVE_INTERVAL_MS);

      // Track state for change detection
      let lastMatchHash = '';
      let lastParticipantCount = 0;
      let lastPredictionHash = '';
      let lastEventUpdatedAt: Date | null = null;

      // Poll for changes
      const pollInterval = setInterval(async () => {
        try {
          // Check for event changes
          const [currentEvent] = await db
            .select()
            .from(events)
            .where(eq(events.id, eventId))
            .limit(1);

          if (!currentEvent) return;

          // Check if event was updated (status change, etc)
          if (currentEvent.updatedAt && lastEventUpdatedAt && currentEvent.updatedAt > lastEventUpdatedAt) {
            sendEvent({
              type: 'event-updated',
              event: currentEvent,
            }, 'update');
          }
          lastEventUpdatedAt = currentEvent.updatedAt || null;

          // Fetch matches and user event joins in parallel (both depend only on eventId)
          const [currentMatches, currentParticipants] = await Promise.all([
            db.select().from(matches).where(eq(matches.eventId, eventId)),
            db.select().from(userEventJoin).where(eq(userEventJoin.eventId, eventId)),
          ]);

          // Check for user event join changes
          if (currentParticipants.length !== lastParticipantCount) {
            sendEvent({
              type: 'participants-changed',
              count: currentParticipants.length,
            }, 'update');
            lastParticipantCount = currentParticipants.length;
          }

          // Fetch match participants and predictions in parallel (both depend on matchIds)
          const matchIds = currentMatches.map(m => m.id);
          const [currentParticipantsData, allPredictions] = await Promise.all([
            matchIds.length > 0
              ? db.select().from(matchParticipants).where(inArray(matchParticipants.matchId, matchIds))
              : Promise.resolve([] as (typeof matchParticipants.$inferSelect)[]),
            matchIds.length > 0
              ? db
                  .select({
                    id: matchPredictions.id,
                    matchId: matchPredictions.matchId,
                    userId: matchPredictions.userId,
                    predictedSide: matchPredictions.predictedSide,
                    predictedParticipantId: matchPredictions.predictedParticipantId,
                    updatedAt: matchPredictions.updatedAt,
                  })
                  .from(matchPredictions)
                  .where(inArray(matchPredictions.matchId, matchIds))
              : Promise.resolve([] as { id: string; matchId: string; userId: string; predictedSide: number | null; predictedParticipantId: string | null; updatedAt: Date | null }[]),
          ]);

          // Check for match changes (includes participant changes in hash)
          const participantHash = currentParticipantsData
            .map(p => `${p.matchId}:${p.participantType}:${p.participantId}:${p.side}:${p.entryOrder}`)
            .sort()
            .join('|');

          const matchHash = currentMatches
            .map(m => `${m.id}:${m.matchOrder}:${m.isLocked}:${m.winningSide}:${m.winnerParticipantId}:${m.outcome}`)
            .join('|') + '::' + participantHash;

          if (matchHash !== lastMatchHash) {
            sendEvent({
              type: 'matches-changed',
              count: currentMatches.length,
            }, 'update');
            lastMatchHash = matchHash;
          }

          // Check for prediction changes
          if (matchIds.length > 0) {
            const predictionHash = allPredictions
              .map(p => `${p.matchId}:${p.userId}:${p.predictedSide}:${p.predictedParticipantId}`)
              .sort()
              .join('|');

            if (predictionHash !== lastPredictionHash) {
              sendEvent({
                type: 'predictions-changed',
              }, 'update');
              lastPredictionHash = predictionHash;
            }
          }
        } catch (error) {
          console.error('Error polling for updates:', error);
        }
      }, SSE_POLL_INTERVAL_MS);

      // Cleanup helper
      const cleanup = () => {
        clearTimeout(connectionTimer);
        clearInterval(keepAliveInterval);
        clearInterval(pollInterval);
        untrackConnection(userId, connectionId);
      };

      // Maximum connection duration to prevent resource leaks
      const connectionTimer = setTimeout(() => {
        console.log(`SSE connection timeout for event ${eventId}, closing after ${SSE_MAX_CONNECTION_DURATION_MS}ms`);
        clearInterval(keepAliveInterval);
        clearInterval(pollInterval);
        untrackConnection(userId, connectionId);
        try {
          sendEvent({ type: 'timeout', message: 'Connection closed due to timeout' }, 'close');
        } catch (e) {
          // Controller might already be closed
        }
        controller.close();
      }, SSE_MAX_CONNECTION_DURATION_MS);

      // Cleanup on client disconnect
      req.signal.addEventListener('abort', () => {
        cleanup();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
