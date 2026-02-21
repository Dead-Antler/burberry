"use client"

import { useRouter } from "next/navigation"
import { Calendar, Users, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getPlacement, getPlacementStyle, getMedal } from "./leaderboard-utils"
import type { Event, Leaderboard } from "@/app/lib/api-types"

interface EventLeaderboardCardProps {
  event: Event
  leaderboard: Leaderboard
  currentUserId?: string
}

export function EventLeaderboardCard({ event, leaderboard, currentUserId }: EventLeaderboardCardProps) {
  const router = useRouter()

  const topThree = leaderboard.slice(0, 3)
  const currentUserScore = leaderboard.find(s => s.userId === currentUserId)
  const currentUserIdx = leaderboard.findIndex(s => s.userId === currentUserId)
  const currentUserRank = currentUserScore
    ? getPlacement(leaderboard, currentUserIdx, (s) => s.totalScore)
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{event.name}</CardTitle>
            <CardDescription className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(event.eventDate).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {leaderboard.length} participants
              </span>
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/events/${event.id}`)}
          >
            View Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scores available for this event
          </p>
        ) : (
          <>
            {/* Top 3 Podium */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {topThree.map((score, index) => {
                const placement = getPlacement(topThree, index, (s) => s.totalScore)
                const { bgClass, borderClass } = getPlacementStyle(placement)
                const medal = getMedal(placement)
                const isCurrentUser = currentUserId === score.userId

                return (
                  <div
                    key={score.userId}
                    className={`p-3 rounded-lg border ${bgClass || ''} ${borderClass}`}
                  >
                    <div className="text-center min-w-0">
                      <div className="text-3xl mb-2">{medal}</div>
                      <div className="font-medium text-sm mb-1 truncate">
                        {score.user?.name || score.user?.email || 'Unknown User'}
                        {isCurrentUser && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold">
                        {score.totalScore}
                      </div>
                      <div className="text-xs text-muted-foreground">points</div>
                      {score.isContrarian && (
                        <Badge
                          variant={score.didWinContrarian ? "default" : "secondary"}
                          className="mt-2 text-xs"
                        >
                          Contrarian {score.didWinContrarian ? '✓' : '✗'}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Current User's Position (if not in top 3) */}
            {currentUserScore && currentUserRank && currentUserRank > 3 && (
              <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-bold text-primary">#{currentUserRank}</span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">Your Position</div>
                      <div className="text-xs text-muted-foreground">
                        {currentUserScore.matchPredictions.total + currentUserScore.customPredictions.total} predictions
                        {currentUserScore.isContrarian && (
                          <span className="ml-1 text-red-600 dark:text-red-400">
                            · Contrarian
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{currentUserScore.totalScore}</div>
                    <div className="text-xs text-muted-foreground">points</div>
                  </div>
                </div>
              </div>
            )}

            {/* Full Rankings Link */}
            {leaderboard.length > 3 && (
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/events/${event.id}`)}
                >
                  View Full Rankings ({leaderboard.length} total)
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
