"use client"

import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
            {leaderboard
              .sort((a, b) => b.totalScore - a.totalScore)
              .map((score, index) => {
                const participant = participants.find((p) => p.userId === score.userId)
                const isCurrentUser = currentUserId === score.userId
                const placement = index + 1

                const positionFromBottom = leaderboard.length - index - 1
                const isVisible = hasAnimated || (isAnimating && visibleCount > positionFromBottom)

                let bgClass = ''
                let borderClass = 'border'
                if (placement === 1) {
                  bgClass = 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20'
                  borderClass = 'border-yellow-400 dark:border-yellow-600'
                } else if (placement === 2) {
                  bgClass = 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/20 dark:to-slate-700/20'
                  borderClass = 'border-slate-400 dark:border-slate-500'
                } else if (placement === 3) {
                  bgClass = 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20'
                  borderClass = 'border-orange-400 dark:border-orange-600'
                }

                let scaleClass = ''
                if (placement === 1) scaleClass = 'scale-105'
                else if (placement === 2) scaleClass = 'scale-[1.03]'
                else if (placement === 3) scaleClass = 'scale-[1.01]'
                else scaleClass = 'scale-95'

                return (
                  <div
                    key={score.userId}
                    className={`flex items-center justify-between p-4 rounded-lg transition-all duration-500 ${borderClass} ${bgClass} ${
                      isVisible
                        ? `opacity-100 translate-y-0 ${scaleClass}`
                        : 'opacity-0 translate-y-4 scale-90'
                    }`}
                    style={{
                      transitionDelay: isVisible ? '0ms' : `${positionFromBottom * 100}ms`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl font-bold w-8 ${
                        placement === 1 ? 'text-yellow-600 dark:text-yellow-400' :
                        placement === 2 ? 'text-slate-600 dark:text-slate-400' :
                        placement === 3 ? 'text-orange-600 dark:text-orange-400' :
                        'text-muted-foreground'
                      }`}>
                        #{placement}
                      </div>
                      <Avatar className="h-10 w-10">
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
                          Match: {score.matchPredictions.correct}/{score.matchPredictions.total}
                          {score.customPredictions.total > 0 && (
                            <> · Custom: {score.customPredictions.correct}/{score.customPredictions.total}</>
                          )}
                          {score.isContrarian && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              Contrarian {score.didWinContrarian ? '✓' : '✗'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${
                      placement === 1 ? 'text-yellow-600 dark:text-yellow-400' :
                      placement === 2 ? 'text-slate-600 dark:text-slate-400' :
                      placement === 3 ? 'text-orange-600 dark:text-orange-400' :
                      ''
                    }`}>
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
