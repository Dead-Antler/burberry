import type { MatchParticipantWithData, Wrestler, Group } from './api-types'

/**
 * Display information for a participant in grouped rendering
 */
export interface ParticipantDisplay {
  name: string
  isChampion: boolean
  groups: Array<{ id: string; name: string }>
}

/**
 * A run of consecutive participants that share at least one group
 */
export interface ParticipantRun {
  participants: ParticipantDisplay[]
  sharedGroups: Array<{ id: string; name: string }>
}

/**
 * Group consecutive participants by their shared groups.
 * Returns runs of participants that share at least one common group.
 *
 * Example: For participants [A{FTR}, B{FTR}, C{}]
 * Returns: [{ participants: [A, B], sharedGroups: [FTR] }, { participants: [C], sharedGroups: [] }]
 *
 * This enables efficient rendering like "Dax & Cash <FTR>" instead of "Dax <FTR> & Cash <FTR>"
 */
export function groupParticipantsBySharedGroups(
  participants: ParticipantDisplay[]
): ParticipantRun[] {
  if (participants.length === 0) return []

  const result: ParticipantRun[] = []
  let i = 0

  while (i < participants.length) {
    // Start a new run - track groups shared by all members in this run
    let sharedGroupIds = new Set(participants[i].groups.map((g) => g.id))
    let runEnd = i

    // Extend run as long as there are shared groups with the next participant
    while (runEnd + 1 < participants.length) {
      const nextGroupIds = new Set(participants[runEnd + 1].groups.map((g) => g.id))
      const intersection = new Set([...sharedGroupIds].filter((id) => nextGroupIds.has(id)))

      if (intersection.size === 0) break // No shared groups, end this run

      sharedGroupIds = intersection
      runEnd++
    }

    // Collect participants in this run
    const runParticipants = participants.slice(i, runEnd + 1)
    const sharedGroups = participants[i].groups.filter((g) => sharedGroupIds.has(g.id))

    result.push({
      participants: runParticipants,
      sharedGroups,
    })

    i = runEnd + 1
  }

  return result
}

/**
 * Type guard to check if a participant is a Wrestler (has currentName)
 */
export function isWrestler(
  participant: Wrestler | Group
): participant is Wrestler {
  return 'currentName' in participant
}

/**
 * Get the display name for a match participant (wrestler or group)
 */
export function getParticipantName(participant: MatchParticipantWithData): string {
  return isWrestler(participant.participant)
    ? participant.participant.currentName
    : participant.participant.name
}

/**
 * Get the display name from a direct participant object (wrestler or group)
 */
export function getDisplayName(participant: Wrestler | Group): string {
  return isWrestler(participant)
    ? participant.currentName
    : participant.name
}

/**
 * Group participants by their side number
 * Returns a Map where keys are side numbers (or null for free-for-all)
 */
export function groupParticipantsBySide(
  participants: MatchParticipantWithData[]
): Map<number | null, MatchParticipantWithData[]> {
  const groups = new Map<number | null, MatchParticipantWithData[]>()

  for (const participant of participants) {
    const side = participant.side
    if (!groups.has(side)) {
      groups.set(side, [])
    }
    groups.get(side)!.push(participant)
  }

  return groups
}
