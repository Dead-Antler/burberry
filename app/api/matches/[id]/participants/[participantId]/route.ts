import { NextRequest } from 'next/server';
import { db } from '@/app/lib/db';
import { matchParticipants } from '@/app/lib/schema';
import { eq } from 'drizzle-orm';
import { apiHandler, apiSuccess, apiError, parseBodyWithSchema } from '@/app/lib/api-helpers';
import { updateMatchParticipantSchema } from '@/app/lib/validation-schemas';

/**
 * PATCH /api/matches/:id/participants/:participantId
 * Update a match participant
 */
export const PATCH = apiHandler(async (req: NextRequest, { params }) => {
  if (!params?.id || !params?.participantId) {
    throw apiError('Match ID and participant ID are required');
  }

  const body = await parseBodyWithSchema(req, updateMatchParticipantSchema);

  if (body.side === undefined && body.entryOrder === undefined && !body.participantType && !body.participantId) {
    throw apiError('No fields to update');
  }

  const updateData: Record<string, unknown> = {};

  if (body.side !== undefined) updateData.side = body.side;
  if (body.participantType !== undefined) updateData.participantType = body.participantType;
  if (body.participantId !== undefined) updateData.participantId = body.participantId;
  if (body.entryOrder !== undefined) updateData.entryOrder = body.entryOrder;

  const [updatedParticipant] = await db
    .update(matchParticipants)
    .set(updateData)
    .where(eq(matchParticipants.id, params.participantId))
    .returning();

  if (!updatedParticipant) {
    throw apiError('Participant not found', 404);
  }

  return apiSuccess(updatedParticipant);
}, { requireAdmin: true });

/**
 * DELETE /api/matches/:id/participants/:participantId
 * Remove a participant from a match
 */
export const DELETE = apiHandler(async (_req, { params }) => {
  if (!params?.id || !params?.participantId) {
    throw apiError('Match ID and participant ID are required');
  }

  const [deletedParticipant] = await db
    .delete(matchParticipants)
    .where(eq(matchParticipants.id, params.participantId))
    .returning();

  if (!deletedParticipant) {
    throw apiError('Participant not found', 404);
  }

  return apiSuccess({ message: 'Participant removed successfully', id: params.participantId });
}, { requireAdmin: true });
