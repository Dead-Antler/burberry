import type { MatchParticipantWithData, Wrestler, TagTeam } from './api-types'

/**
 * Type guard to check if a participant is a Wrestler (has currentName)
 */
export function isWrestler(
  participant: Wrestler | TagTeam
): participant is Wrestler {
  return 'currentName' in participant
}

/**
 * Get the display name for a match participant (wrestler or tag team)
 */
export function getParticipantName(participant: MatchParticipantWithData): string {
  return isWrestler(participant.participant)
    ? participant.participant.currentName
    : participant.participant.name
}

/**
 * Get the display name from a direct participant object (wrestler or tag team)
 */
export function getDisplayName(participant: Wrestler | TagTeam): string {
  return isWrestler(participant)
    ? participant.currentName
    : participant.name
}
