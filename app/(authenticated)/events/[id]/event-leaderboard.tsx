"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getPlacement, getPlacementStyle } from "@/app/(authenticated)/leaderboard/leaderboard-utils"
import type { Event, EventJoinWithUser, Leaderboard } from "@/app/lib/api-types"

interface EventLeaderboardProps {
  event: Event
  leaderboard: Leaderboard | null
  participants: EventJoinWithUser[]
  currentUserId?: string
  isAnimating: boolean
  visibleCount: number
  hasAnimated: boolean
  onReplay: () => void
}

export function EventLeaderboard({
  event,
  leaderboard,
  participants,
  currentUserId,
  isAnimating,
  visibleCount,
  hasAnimated,
  onReplay,
}: EventLeaderboardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {event.status === 'completed'
                ? 'Final leaderboard for this event'
                : 'Results will be available once the event is completed'}
            </CardDescription>
          </div>
          {event.status === 'completed' && leaderboard && leaderboard.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReplay}
              disabled={isAnimating}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Replay
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {event.status !== 'completed' ? (
          <div className="p-8 text-center text-muted-foreground">
            Results are not yet available. Check back once the event is completed!
          </div>
        ) : leaderboard === null ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading results...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No scores available for this event
          </div>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((score, index) => {
                const participant = participants.find((p) => p.userId === score.userId)
                const isCurrentUser = currentUserId === score.userId
                const placement = getPlacement(leaderboard, index, (s) => s.totalScore)

                const positionFromBottom = leaderboard.length - index - 1
                const isVisible = hasAnimated || (isAnimating && visibleCount > positionFromBottom)

                const { bgClass, borderClass, textClass } = getPlacementStyle(placement)

                const widthClass = placement === 1 ? 'w-full' : placement === 2 ? 'w-[95%]' : placement === 3 ? 'w-[90%]' : 'w-[85%]'

                return (
                  <div
                    key={score.userId}
                    className={`flex items-center justify-between p-4 rounded-lg transition-all duration-500 mx-auto ${widthClass} ${borderClass} ${bgClass} ${
                      isVisible
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4'
                    }`}
                    style={{
                      transitionDelay: isVisible ? '0ms' : `${positionFromBottom * 100}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-bold w-8 ${textClass}`}>
                        #{placement}
                      </div>
                      <Avatar className="h-10 w-10">
                        {participant?.user.image && <AvatarImage src={participant.user.image} alt={participant.user.name || participant.user.email} />}
                        <AvatarFallback>
                          {participant?.user.name?.[0]?.toUpperCase() ||
                           participant?.user.email[0].toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          <span>{participant?.user.name || participant?.user.email || 'Unknown User'}</span>
                          {placement === 1 && <span className="text-yellow-600 dark:text-yellow-400">👑</span>}
                          {isCurrentUser && (
                            <Badge variant="outline" className={`text-xs ${
                              placement <= 3
                                ? 'bg-background/50'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}>
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {score.zeroedByContrarian ? (
                            <span className="text-red-600 dark:text-red-400">Zeroed by contrarian</span>
                          ) : score.isContrarian && score.didWinContrarian ? (
                            <>
                              {score.matchPredictions.total - score.matchPredictions.correct} wrong match{score.matchPredictions.total - score.matchPredictions.correct !== 1 ? 'es' : ''}
                              {score.customPredictions.total > 0 && (
                                <> · Custom: {score.customPredictions.points}/{score.customPredictions.total}</>
                              )}
                              {score.placementBonus > 0 && (
                                <> · <span className="font-medium text-green-600 dark:text-green-400">+{score.placementBonus} bonus</span></>
                              )}
                            </>
                          ) : score.isContrarian ? (
                            <>
                              Custom: {score.customPredictions.points}/{score.customPredictions.total}
                            </>
                          ) : (
                            <>
                              Match: {score.matchPredictions.correct}/{score.matchPredictions.total}
                              {score.customPredictions.total > 0 && (
                                <> · Custom: {score.customPredictions.points}/{score.customPredictions.total}</>
                              )}
                              {score.placementBonus > 0 && (
                                <> · <span className="font-medium text-green-600 dark:text-green-400">+{score.placementBonus} bonus</span></>
                              )}
                            </>
                          )}
                          {score.isContrarian && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Contrarian {score.didWinContrarian ? '✓' : '✗'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${textClass}`}>
                      {score.totalScore} pts
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
