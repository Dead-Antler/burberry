import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matchParticipants, wrestlers, tagTeams } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema, generateId } from '@/app/lib/api-helpers';
import { addMatchParticipantSchema } from '@/app/lib/validation-schemas';

/**
 * GET /api/matches/:id/participants
 * Get participants for a match
 */
export const GET = apiHandler(async (_req, { params }) => {
  if (!params?.id) {
    throw apiError('Match ID is required');
  }

  const participants = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, params.id));

  // Enrich participants with wrestler/tag team data
  const enrichedParticipants = await Promise.all(
    participants.map(async (participant) => {
      if (participant.participantType === 'wrestler') {
        const [wrestler] = await db.select().from(wrestlers).where(eq(wrestlers.id, participant.participantId));
        return { ...participant, participant: wrestler };
      } else {
        const [tagTeam] = await db.select().from(tagTeams).where(eq(tagTeams.id, participant.participantId));
        return { ...participant, participant: tagTeam };
      }
    })
  );

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
      createdAt: new Date(),
    })
    .returning();

  return apiSuccess(newParticipant, 201);
}, { requireAdmin: true });
