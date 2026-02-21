"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { GroupBadge } from "@/app/components/ui/group-badge"
import type { MatchWithParticipants, MatchPrediction, MatchPredictionStats } from "@/app/lib/api-types"
import { getParticipantDisplayName } from "@/app/lib/api-types"

interface FreeForAllPredictionProps {
  match: MatchWithParticipants
  userPrediction?: MatchPrediction
  stats?: MatchPredictionStats
  hidePredictors: boolean
  isLocked: boolean
  isSaving: boolean
  onPredictionChange: (participantId: string) => void
}

export function FreeForAllPrediction({
  match,
  userPrediction,
  stats,
  hidePredictors,
  isLocked,
  isSaving,
  onPredictionChange,
}: FreeForAllPredictionProps) {
  const hasWinner = match.winnerParticipantId !== null

  // Get all participants
  const allParticipants = match.participants.map((p) => ({
    ...p,
    name: getParticipantDisplayName(p.participant),
  }))

  const renderParticipantLabel = (participantId: string) => {
    const participant = allParticipants.find((p) => p.participantId === participantId)
    return participant?.name || 'Unknown'
  }

  const isUserCorrect = hasWinner && userPrediction && userPrediction.predictedParticipantId === match.winnerParticipantId
  const isUserIncorrect = hasWinner && userPrediction && userPrediction.predictedParticipantId !== match.winnerParticipantId

  return (
    <div className="space-y-2">
      <Select
        value={userPrediction?.predictedParticipantId ?? ''}
        onValueChange={onPredictionChange}
        disabled={isLocked || isSaving}
      >
        <SelectTrigger
          className={
            hasWinner && userPrediction
              ? userPrediction.predictedParticipantId === match.winnerParticipantId
                ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-800'
                : 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800'
              : ''
          }
          aria-label="Select match winner"
          aria-describedby={hasWinner ? `match-${match.id}-ffa-result` : undefined}
        >
          <SelectValue placeholder="Select winner..." />
          {isUserCorrect && <span className="sr-only">Your prediction was correct</span>}
          {isUserIncorrect && <span className="sr-only">Your prediction was incorrect</span>}
        </SelectTrigger>
        <SelectContent>
          {allParticipants.map((p) => {
            const isWinner = match.winnerParticipantId === p.participantId
            return (
              <SelectItem key={p.id} value={p.participantId}>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1">
                    {p.name}
                    {p.entryOrder && ` (#${p.entryOrder})`}
                    {p.isChampion && ' (c)'}
                    {p.groups?.map((g) => (
                      <GroupBadge key={g.id} groupName={g.name} size="md" />
                    ))}
                  </span>
                  {isWinner && (
                    <Badge
                      variant="default"
                      className="text-xs bg-green-600"
                      role="status"
                      aria-label="Match winner"
                    >
                      ✓ WINNER
                    </Badge>
                  )}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {/* Show stats for free-for-all */}
      {stats && stats.distribution.length > 0 && (
        <div className="space-y-2">
          {stats.distribution
            .filter((d) => d.count > 0)
            .sort((a, b) => b.percentage - a.percentage)
            .map((dist) => (
              <div key={dist.participantId} className="space-y-1 rounded-md py-1 px-2">
                <div className="font-medium text-xs mb-1 flex items-center gap-1">
                  {renderParticipantLabel(dist.participantId!)}
                  {allParticipants.find((p) => p.participantId === dist.participantId)?.groups?.map((g) => (
                    <GroupBadge key={g.id} groupName={g.name} size="md" />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{dist.percentage}%</span>
                  <span>
                    {dist.count} prediction{dist.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <Progress
                  value={dist.percentage}
                  className="h-1"
                  aria-label={`${dist.percentage}% of predictions for ${renderParticipantLabel(dist.participantId!)}`}
                />
                {!hidePredictors && dist.predictors && (
                  <div className="flex gap-1 flex-wrap">
                    {dist.predictors.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
