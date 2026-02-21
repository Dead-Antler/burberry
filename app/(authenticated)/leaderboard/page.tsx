"use client"

import { useEffect, useState } from "react"
import { Trophy, Calendar } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { OverallStandings } from "./overall-standings"
import { EventLeaderboardCard } from "./event-leaderboard-card"
import type { Event, Leaderboard, OverallLeaderboard } from "@/app/lib/api-types"

type EventWithLeaderboard = {
  event: Event
  leaderboard: Leaderboard
}

export default function LeaderboardPage() {
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

  const currentUserId = session?.user?.id

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
        <OverallStandings leaderboard={overallLeaderboard} currentUserId={currentUserId} />

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
                  {filteredEvents.map(({ event, leaderboard }) => (
                    <EventLeaderboardCard
                      key={event.id}
                      event={event}
                      leaderboard={leaderboard}
                      currentUserId={currentUserId}
                    />
                  ))}
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
