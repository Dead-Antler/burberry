"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy, Calendar, Users, ArrowRight } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { useSession } from "@/app/lib/auth-client"
import type { Event, Leaderboard, OverallLeaderboard } from "@/app/lib/api-types"

type EventWithLeaderboard = {
  event: Event
  leaderboard: Leaderboard
}

export default function LeaderboardPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [allEvents, setAllEvents] = useState<EventWithLeaderboard[]>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [overallLeaderboard, setOverallLeaderboard] = useState<OverallLeaderboard>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch overall leaderboard and completed events in parallel
        const [overall, events] = await Promise.all([
          apiClient.getOverallLeaderboard(),
          apiClient.getEvents({ status: 'completed' })
        ])

        setOverallLeaderboard(overall)

        // Fetch leaderboard for each completed event
        const eventsWithLeaderboards = await Promise.all(
          events.map(async (event) => {
            try {
              const leaderboard = await apiClient.getLeaderboard(event.id)
              return { event, leaderboard }
            } catch (err) {
              console.error(`Failed to fetch leaderboard for event ${event.id}:`, err)
              return { event, leaderboard: [] }
            }
          })
        )

        // Sort by event date (most recent first)
        eventsWithLeaderboards.sort((a, b) =>
          new Date(b.event.eventDate).getTime() - new Date(a.event.eventDate).getTime()
        )

        setAllEvents(eventsWithLeaderboards)

        // Extract unique years from events
        const years = Array.from(
          new Set(
            eventsWithLeaderboards.map((e) => new Date(e.event.eventDate).getFullYear())
          )
        ).sort((a, b) => b - a) // Most recent year first

        setAvailableYears(years)

        // Set selected year to current year if it has events, otherwise most recent year
        const currentYear = new Date().getFullYear()
        if (years.includes(currentYear)) {
          setSelectedYear(currentYear)
        } else if (years.length > 0) {
          setSelectedYear(years[0])
        }
      } catch (err) {
        const message = err instanceof ApiClientError
          ? err.message
          : "Failed to load leaderboard data"
        setError(message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Filter events by selected year
  const filteredEvents = allEvents.filter(
    (e) => new Date(e.event.eventDate).getFullYear() === selectedYear
  )

  if (isLoading) {
    return (
      <>
        <SiteHeader breadcrumbs={[{ label: "Leaderboard" }]} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <SiteHeader breadcrumbs={[{ label: "Leaderboard" }]} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader breadcrumbs={[{ label: "Leaderboard" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Page Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Leaderboard</CardTitle>
                <CardDescription>
                  Results from all completed events
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Overall Leaderboard */}
        {overallLeaderboard.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Overall Standings</CardTitle>
              <CardDescription>
                Cumulative scores across all completed events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overallLeaderboard.slice(0, 10).map((score, index) => {
                  const placement = index === 0 || score.totalPoints !== overallLeaderboard[index - 1].totalPoints
                    ? index + 1
                    : overallLeaderboard.findIndex((s) => s.totalPoints === score.totalPoints) + 1
                  const isCurrentUser = session?.user?.id === score.userId

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

                  const widthClass = placement === 1 ? 'w-full' : placement === 2 ? 'w-[95%]' : placement === 3 ? 'w-[90%]' : 'w-[85%]'

                  return (
                    <div
                      key={score.userId}
                      className={`flex items-center justify-between p-4 rounded-lg transition-all mx-auto ${widthClass} ${borderClass} ${bgClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-xl font-bold w-8 text-center ${
                          placement === 1 ? 'text-yellow-600 dark:text-yellow-400' :
                          placement === 2 ? 'text-slate-600 dark:text-slate-400' :
                          placement === 3 ? 'text-orange-600 dark:text-orange-400' :
                          'text-muted-foreground'
                        }`}>
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
                        <div className={`text-2xl font-bold ${
                          placement === 1 ? 'text-yellow-600 dark:text-yellow-400' :
                          placement === 2 ? 'text-slate-600 dark:text-slate-400' :
                          placement === 3 ? 'text-orange-600 dark:text-orange-400' :
                          ''
                        }`}>
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
        )}

        {/* Recent Events Section */}
        {allEvents.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Recent Events</CardTitle>
                  <CardDescription>
                    Event results by year
                  </CardDescription>
                </div>
                {availableYears.length > 1 && (
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No events found for {selectedYear}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map(({ event, leaderboard }) => {
              const topThree = leaderboard.slice(0, 3)
              const currentUserScore = leaderboard.find(s => s.userId === session?.user?.id)
              const currentUserIdx = leaderboard.findIndex(s => s.userId === session?.user?.id)
              const currentUserRank = currentUserScore
                ? (currentUserIdx === 0 || leaderboard[currentUserIdx].totalScore !== leaderboard[currentUserIdx - 1].totalScore
                    ? currentUserIdx + 1
                    : leaderboard.findIndex(s => s.totalScore === currentUserScore.totalScore) + 1)
                : null

              return (
                <Card key={event.id}>
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
                            const placement = index === 0 || score.totalScore !== topThree[index - 1].totalScore
                              ? index + 1
                              : topThree.findIndex((s) => s.totalScore === score.totalScore) + 1
                            let bgClass = ''
                            let medal = ''

                            if (placement === 1) {
                              bgClass = 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30 border-yellow-400 dark:border-yellow-600'
                              medal = '🥇'
                            } else if (placement === 2) {
                              bgClass = 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/30 dark:to-slate-700/30 border-slate-400 dark:border-slate-500'
                              medal = '🥈'
                            } else if (placement === 3) {
                              bgClass = 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30 border-orange-400 dark:border-orange-600'
                              medal = '🥉'
                            }

                            const isCurrentUser = session?.user?.id === score.userId

                            return (
                              <div
                                key={score.userId}
                                className={`p-3 rounded-lg border ${bgClass}`}
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
            })}
          </div>
        )}
            </CardContent>
          </Card>
        )}

        {/* Empty state when no events at all */}
        {allEvents.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Trophy className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No completed events yet. Check back after an event finishes!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
