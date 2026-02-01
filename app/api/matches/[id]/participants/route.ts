import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matchParticipants } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, generateId } from '@/app/lib/api-helpers';
import { addMatchParticipantSchema } from '@/app/lib/validation-schemas';
import { matchService } from '@/app/lib/services';

/**
 * GET /api/matches/:id/participants
 * Get participants for a match (batch loaded to avoid N+1 queries)
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const enrichedParticipants = await matchService.getParticipants(params.id);
  return apiSuccess(enrichedParticipants);
});

/**
 * POST /api/matches/:id/participants
 * Add a participant to a match
 */
export const POST = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const body = await parseBodyWithSchema(req, addMatchParticipantSchema);

  const [newParticipant] = await db
    .insert(matchParticipants)
    .values({
      id: generateId('participant'),
      matchId: params.id,
      side: body.side ?? null,
      participantType: body.participantType,
      participantId: body.participantId,
      entryOrder: body.entryOrder ?? null,
      isChampion: body.isChampion ?? false,
      createdAt: new Date(),
    })
    .returning();

  return apiSuccess(newParticipant, 201);
}, { requireAdmin: true });
