"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, CircleDot, CircleMinus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
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

  const hasPrediction = !!userPrediction
  const isCompleted = eventStatus === "completed"
  const isCorrect = isCompleted && userPrediction?.isCorrect === true
  const isIncorrect = isCompleted && userPrediction?.isCorrect === false
  const isMissed = isLocked && !hasPrediction

  const statusIndicator = isCorrect
    ? { icon: CheckCircle2, label: "Correct", className: "text-green-600 dark:text-green-500" }
    : isIncorrect
      ? { icon: XCircle, label: "Incorrect", className: "text-red-600 dark:text-red-500" }
      : isMissed
        ? { icon: CircleMinus, label: "No prediction", className: "text-muted-foreground" }
        : hasPrediction
          ? { icon: CircleDot, label: "Predicted", className: "text-primary" }
          : null

  return (
    <Card
      className={cn(
        "py-0 border-l-4",
        isCorrect && "border-l-green-600 dark:border-l-green-500",
        isIncorrect && "border-l-red-600 dark:border-l-red-500",
        hasPrediction && !isCorrect && !isIncorrect && "border-l-primary",
        isMissed && "border-l-muted-foreground/40",
        !hasPrediction && !isMissed && "border-l-transparent",
      )}
    >
      <CardContent className="p-4">
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
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <MatchHeader match={match} isLocked={isLocked} />
              </div>
              {statusIndicator && (
                <div className={cn("flex items-center gap-1 text-xs shrink-0", statusIndicator.className)}>
                  <statusIndicator.icon className="h-3.5 w-3.5" />
                  <span>{statusIndicator.label}</span>
                </div>
              )}
            </div>

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
      </CardContent>
    </Card>
  )
}
