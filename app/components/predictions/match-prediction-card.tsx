"use client"

import { useState } from "react"
import { MatchHeader } from "./match-header"
import { TeamMatchPrediction } from "./team-match-prediction"
import { FreeForAllPrediction } from "./free-for-all-prediction"
import { WrestlerSearchPrediction } from "./wrestler-search-prediction"
import { MatchAdminControls } from "../matches/match-admin-controls"
import type {
  MatchWithParticipants,
  MatchPrediction,
  MatchPredictionStats,
} from "@/app/lib/api-types"

interface MatchPredictionCardProps {
  match: MatchWithParticipants
  userPrediction?: MatchPrediction
  stats?: MatchPredictionStats
  hidePredictors: boolean
  isLocked: boolean
  isAdmin?: boolean
  eventStatus: string
  onPredictionChange: (data: { predictedSide?: number; predictedParticipantId?: string }) => Promise<void>
  onMatchUpdate?: (matchId: string, data: any) => Promise<void>
}

export function MatchPredictionCard({
  match,
  userPrediction,
  stats,
  hidePredictors,
  isLocked,
  isAdmin,
  eventStatus,
  onPredictionChange,
  onMatchUpdate,
}: MatchPredictionCardProps) {
  const [isSaving, setIsSaving] = useState(false)

  // Check if match has no participants (need to search for wrestlers)
  const hasNoParticipants = match.participants.length === 0

  // Determine if this is a team match (has sides) or free-for-all (no sides)
  const isTeamMatch = match.participants.some((p) => p.side !== null)

  const handleTeamMatchPrediction = async (side: number) => {
    if (isLocked) return
    setIsSaving(true)
    try {
      await onPredictionChange({ predictedSide: side })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFreeForAllPrediction = async (participantId: string) => {
    if (isLocked) return
    setIsSaving(true)
    try {
      await onPredictionChange({ predictedParticipantId: participantId })
    } finally {
      setIsSaving(false)
    }
  }

  const handleWrestlerSelection = async (wrestlerId: string) => {
    if (isLocked) return
    setIsSaving(true)
    try {
      await onPredictionChange({ predictedParticipantId: wrestlerId })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-4 hover:bg-accent/50 transition-colors">
      {isSaving && (
        <div
          role="status"
          aria-live="polite"
          className="sr-only"
        >
          Saving prediction...
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <MatchHeader match={match} isLocked={isLocked} />

          {/* Render appropriate prediction UI based on match type */}
          {hasNoParticipants ? (
            <WrestlerSearchPrediction
              match={match}
              userPrediction={userPrediction}
              stats={stats}
              hidePredictors={hidePredictors}
              isLocked={isLocked}
              isSaving={isSaving}
              onPredictionChange={handleWrestlerSelection}
            />
          ) : isTeamMatch ? (
            <TeamMatchPrediction
              match={match}
              userPrediction={userPrediction}
              stats={stats}
              hidePredictors={hidePredictors}
              isLocked={isLocked}
              isSaving={isSaving}
              onPredictionChange={handleTeamMatchPrediction}
            />
          ) : (
            <FreeForAllPrediction
              match={match}
              userPrediction={userPrediction}
              stats={stats}
              hidePredictors={hidePredictors}
              isLocked={isLocked}
              isSaving={isSaving}
              onPredictionChange={handleFreeForAllPrediction}
            />
          )}
        </div>
      </div>

      {/* Admin Controls */}
      {isAdmin && onMatchUpdate && (
        <MatchAdminControls
          match={match}
          eventStatus={eventStatus}
          onUpdate={(data) => onMatchUpdate(match.id, data)}
        />
      )}
    </div>
  )
}
