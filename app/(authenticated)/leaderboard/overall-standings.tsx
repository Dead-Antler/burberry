"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getPlacement, getPlacementStyle } from "./leaderboard-utils"
import type { OverallLeaderboard } from "@/app/lib/api-types"

interface OverallStandingsProps {
  leaderboard: OverallLeaderboard
  currentUserId?: string
}

export function OverallStandings({ leaderboard, currentUserId }: OverallStandingsProps) {
  if (leaderboard.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overall Standings</CardTitle>
        <CardDescription>
          Cumulative scores across all completed events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {leaderboard.slice(0, 10).map((score, index) => {
            const placement = getPlacement(leaderboard, index, (s) => s.totalPoints)
            const isCurrentUser = currentUserId === score.userId
            const { bgClass, borderClass, textClass } = getPlacementStyle(placement)

            const widthClass = placement === 1 ? 'w-full' : placement === 2 ? 'w-[95%]' : placement === 3 ? 'w-[90%]' : 'w-[85%]'

            return (
              <div
                key={score.userId}
                className={`flex items-center justify-between p-4 rounded-lg transition-all mx-auto ${widthClass} ${borderClass} ${bgClass}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-xl font-bold w-8 text-center ${textClass}`}>
                    #{placement}
                  </div>
                  <Avatar className="h-10 w-10">
                    {score.user?.image && <AvatarImage src={score.user.image} alt={score.user.name || score.user.email} />}
                    <AvatarFallback>
                      {score.user?.name?.[0]?.toUpperCase() || score.user?.email[0].toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <span>{score.user?.name || score.user?.email || 'Unknown User'}</span>
                      {isCurrentUser && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {score.eventsParticipated} event{score.eventsParticipated !== 1 ? 's' : ''}
                      {' · '}
                      {score.firstPlaceFinishes} win{score.firstPlaceFinishes !== 1 ? 's' : ''}
                      {' · '}
                      {score.matchPredictions.total + score.customPredictions.total} prediction{score.matchPredictions.total + score.customPredictions.total !== 1 ? 's' : ''}
                      {score.contrarianWins > 0 && (
                        <>
                          {' · '}
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {score.contrarianWins} contrarian
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${textClass}`}>
                    {score.totalPoints}
                  </div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
