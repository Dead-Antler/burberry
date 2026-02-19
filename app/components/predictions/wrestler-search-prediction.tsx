"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { WrestlerSearchSelect } from "./wrestler-search-select"
import { apiClient } from "@/app/lib/api-client"
import type {
  MatchWithParticipants,
  MatchPrediction,
  MatchPredictionStats,
  Wrestler,
} from "@/app/lib/api-types"

interface WrestlerSearchPredictionProps {
  match: MatchWithParticipants
  userPrediction?: MatchPrediction
  stats?: MatchPredictionStats
  hidePredictors: boolean
  isLocked: boolean
  isSaving: boolean
  onPredictionChange: (wrestlerId: string) => void
}

export function WrestlerSearchPrediction({
  match,
  userPrediction,
  stats,
  hidePredictors,
  isLocked,
  isSaving,
  onPredictionChange,
}: WrestlerSearchPredictionProps) {
  const [wrestlers, setWrestlers] = useState<Map<string, Wrestler>>(new Map())
  const hasWinner = match.winnerParticipantId !== null

  // Fetch wrestler data for stats display
  useEffect(() => {
    const wrestlerIds = new Set<string>()

    // Add wrestlers from stats distribution
    if (stats) {
      stats.distribution.forEach((d) => {
        if (d.participantId) wrestlerIds.add(d.participantId)
      })
    }

    // Add the winning wrestler if there is one
    if (match.winnerParticipantId) {
      wrestlerIds.add(match.winnerParticipantId)
    }

    if (wrestlerIds.size > 0) {
      // Fetch wrestler details for stats display
      apiClient
        .getAllWrestlers({ isActive: true })
        .then((data) => {
          const wrestlerMap = new Map<string, Wrestler>()
          const wrestlerData = data as Wrestler[]
          wrestlerData.forEach((w) => {
            if (wrestlerIds.has(w.id)) {
              wrestlerMap.set(w.id, w)
            }
          })
          setWrestlers(wrestlerMap)
        })
        .catch(console.error)
    }
  }, [stats, match.winnerParticipantId])

  return (
    <div className="space-y-2">
      <WrestlerSearchSelect
        value={userPrediction?.predictedParticipantId ?? ''}
        onValueChange={onPredictionChange}
        disabled={isLocked || isSaving}
        placeholder="Select a wrestler to win..."
      />

      {/* Show stats for wrestler predictions */}
      {(stats && stats.distribution.length > 0) || (hasWinner && match.winnerParticipantId) ? (
        <div className="space-y-2 mt-4">
          {(() => {
            // Create a mutable array of distributions
            let distributions = stats?.distribution.filter((d) => d.count > 0) || []

            // If there's a winner and they're not in the distribution, add them
            if (hasWinner && match.winnerParticipantId) {
              const winnerInDistribution = distributions.some(
                (d) => d.participantId === match.winnerParticipantId
              )
              if (!winnerInDistribution) {
                distributions = [
                  {
                    side: null,
                    participantId: match.winnerParticipantId,
                    count: 0,
                    percentage: 0,
                    predictors: null,
                  },
                  ...distributions,
                ]
              }
            }

            return distributions
              .sort((a, b) => {
                // Winner always first
                if (a.participantId === match.winnerParticipantId) return -1
                if (b.participantId === match.winnerParticipantId) return 1
                // Then sort by percentage
                return b.percentage - a.percentage
              })
              .map((dist) => {
                const wrestler = wrestlers.get(dist.participantId!)
                const isWinner = match.winnerParticipantId === dist.participantId
                const isUserPrediction =
                  userPrediction?.predictedParticipantId === dist.participantId
                const isUserCorrect = hasWinner && isUserPrediction && isWinner
                const isUserIncorrect = hasWinner && isUserPrediction && !isWinner

                return (
                  <div
                    key={dist.participantId}
                    className={`space-y-1 rounded-md py-1 px-2 ${
                      isUserCorrect
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : isUserIncorrect
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-xs">
                        {wrestler?.currentName || 'Unknown Wrestler'}
                      </span>
                      {isWinner && (
                        <Badge variant="default" className="text-xs bg-green-600">
                          WINNER
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{dist.percentage}%</span>
                      <span>
                        {dist.count} prediction{dist.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <Progress value={dist.percentage} className="h-1" />
                    {!hidePredictors &&
                      dist.predictors &&
                      dist.predictors.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-1">
                          {dist.predictors.map((name, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      )}
                  </div>
                )
              })
          })()}
        </div>
      ) : null}
    </div>
  )
}
