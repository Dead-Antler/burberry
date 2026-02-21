"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { GroupBadge } from "@/app/components/ui/group-badge"
import { groupParticipantsBySharedGroups, type ParticipantDisplay } from "@/app/lib/participant-utils"
import type { MatchWithParticipants, MatchPrediction, MatchPredictionStats } from "@/app/lib/api-types"
import { getParticipantDisplayName } from "@/app/lib/api-types"

interface TeamMatchPredictionProps {
  match: MatchWithParticipants
  userPrediction?: MatchPrediction
  stats?: MatchPredictionStats
  hidePredictors: boolean
  isLocked: boolean
  isSaving: boolean
  onPredictionChange: (side: number) => void
}

export function TeamMatchPrediction({
  match,
  userPrediction,
  stats,
  hidePredictors,
  isLocked,
  isSaving,
  onPredictionChange,
}: TeamMatchPredictionProps) {
  const hasWinner = match.winningSide !== null

  // Group participants by side
  const getSideParticipants = (side: number) => {
    return match.participants
      .filter((p) => p.side === side)
      .map((p) => ({
        ...p,
        name: getParticipantDisplayName(p.participant),
      }))
  }

  // Get all unique sides
  const sides = Array.from(
    new Set(match.participants.map((p) => p.side).filter((s) => s !== null))
  ) as number[]

  const renderSideLabel = (side: number) => {
    const participants = getSideParticipants(side)
    return participants.map((p) => p.name).join(' & ')
  }

  const renderSideParticipants = (side: number) => {
    const participants: ParticipantDisplay[] = match.participants
      .filter((p) => p.side === side)
      .map((p) => ({
        name: getParticipantDisplayName(p.participant),
        isChampion: p.isChampion,
        groups: p.groups || [],
      }))

    const runs = groupParticipantsBySharedGroups(participants)
    const result: React.ReactNode[] = []
    let keyIndex = 0

    for (const run of runs) {
      for (const p of run.participants) {
        if (result.length > 0) {
          result.push(<span key={`sep-${keyIndex++}`} className="text-muted-foreground"> &amp; </span>)
        }
        result.push(<span key={`p-${keyIndex++}`}>{p.name}</span>)
      }
      for (const g of run.sharedGroups) {
        result.push(
          <GroupBadge key={`g-${keyIndex++}-${g.id}`} groupName={g.name} size="md" className="ml-0.5" />
        )
      }
    }

    return result
  }

  const getStatsForSide = (side: number) => {
    if (!stats) return null
    return stats.distribution.find((d) => d.side === side)
  }

  return (
    <RadioGroup
      value={userPrediction?.predictedSide?.toString() ?? ''}
      onValueChange={(val) => onPredictionChange(parseInt(val))}
      disabled={isLocked || isSaving}
      className="space-y-2"
      aria-label="Select match winner"
      aria-describedby={hasWinner ? `match-${match.id}-result` : undefined}
    >
      {sides.sort((a, b) => a - b).map((side) => {
        const sideStats = getStatsForSide(side)
        const isWinner = match.winningSide === side
        const isUserPrediction = userPrediction?.predictedSide === side
        const isUserCorrect = hasWinner && isUserPrediction && isWinner
        const isUserIncorrect = hasWinner && isUserPrediction && !isWinner

        return (
          <div
            key={side}
            className={`space-y-1 rounded-md py-1 ${
              isUserCorrect
                ? 'bg-green-100 dark:bg-green-900/30 px-2 -mx-2'
                : isUserIncorrect
                ? 'bg-red-100 dark:bg-red-900/30 px-2 -mx-2'
                : ''
            }`}
          >
            <div className="flex items-center space-x-2 py-0.5">
              <RadioGroupItem
                value={side.toString()}
                id={`match-${match.id}-side-${side}`}
                disabled={isLocked || isSaving}
              />
              <Label
                htmlFor={`match-${match.id}-side-${side}`}
                className="flex-1 cursor-pointer flex items-center gap-2 flex-wrap"
              >
                <span className="inline-flex items-center flex-wrap gap-0.5">
                  {renderSideParticipants(side)}
                </span>
                {getSideParticipants(side).some((p) => p.isChampion) && (
                  <Badge variant="secondary" className="text-xs" aria-label="Champion">
                    (c)
                  </Badge>
                )}
                {hasWinner && isWinner && (
                  <Badge
                    variant="default"
                    className="text-xs bg-green-600"
                    role="status"
                    aria-label="Match winner"
                  >
                    ✓ WINNER
                  </Badge>
                )}
                {isUserCorrect && (
                  <span className="sr-only">Your prediction was correct</span>
                )}
                {isUserIncorrect && (
                  <span className="sr-only">Your prediction was incorrect</span>
                )}
              </Label>
            </div>

            {/* Show stats */}
            {sideStats && sideStats.count > 0 && (
              <div className="ml-6 mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{sideStats.percentage}%</span>
                  <span>
                    {sideStats.count} prediction{sideStats.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <Progress
                  value={sideStats.percentage}
                  className="h-1"
                  aria-label={`${sideStats.percentage}% of predictions for ${renderSideLabel(side)}`}
                />
                {!hidePredictors && sideStats.predictors && (
                  <div className="flex gap-1 flex-wrap">
                    {sideStats.predictors.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </RadioGroup>
  )
}
