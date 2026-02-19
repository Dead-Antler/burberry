"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Users, Lock, CheckCircle } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { JoinEventDialog } from "@/app/components/events/join-event-dialog"
import type { Event, EventJoin, Brand } from "@/app/lib/api-types"

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [userJoins, setUserJoins] = useState<Map<string, EventJoin>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch all events (not just open ones)
      const [eventsData, brandsData] = await Promise.all([
        apiClient.getEvents({}),
        apiClient.getBrands(),
      ])

      // Sort events: open first, then locked, then completed, then pending
      const statusOrder: Record<string, number> = { open: 0, locked: 1, completed: 2, pending: 3 }
      eventsData.sort((a, b) => {
        const aOrder = statusOrder[a.status] ?? 999
        const bOrder = statusOrder[b.status] ?? 999
        const statusDiff = aOrder - bOrder
        if (statusDiff !== 0) return statusDiff
        // Within same status, sort by date (most recent first)
        const dateDiff = new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        if (dateDiff !== 0) return dateDiff
        // If dates are the same, sort by createdAt (most recent first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

      setEvents(eventsData)
      setBrands(brandsData)

      // Check join status for each event
      const joins = new Map<string, EventJoin>()
      await Promise.all(
        eventsData.map(async (event) => {
          try {
            const joinStatus = await apiClient.getEventJoinStatus(event.id)
            joins.set(event.id, joinStatus)
          } catch (err) {
            // User hasn't joined this event - that's okay
          }
        })
      )
      setUserJoins(joins)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load events"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleJoinSuccess = (eventId: string, join: EventJoin) => {
    setUserJoins((prev) => new Map(prev).set(eventId, join))
    setJoiningEventId(null)
    // Navigate to event prediction page
    router.push(`/events/${eventId}`)
  }

  const handleViewEvent = (eventId: string) => {
    router.push(`/events/${eventId}`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="gap-1">
            <Calendar className="h-3 w-3" />
            Pending
          </Badge>
        )
      case 'open':
        return (
          <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
            <Users className="h-3 w-3" />
            Open
          </Badge>
        )
      case 'locked':
        return (
          <Badge variant="destructive" className="gap-1">
            <Lock className="h-3 w-3" />
            Live
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getBrandName = (brandId: string) => {
    return brands.find((b) => b.id === brandId)?.name || 'Unknown'
  }

  if (isLoading) {
    return (
      <>
        <SiteHeader breadcrumbs={[{ label: "Events" }]} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <SiteHeader breadcrumbs={[{ label: "Events" }]} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-destructive">{error}</p>
                <Button onClick={fetchData}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  const joiningEvent = joiningEventId ? events.find((e) => e.id === joiningEventId) : null

  return (
    <>
      <SiteHeader breadcrumbs={[{ label: "Events" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">
            Browse all wrestling events - join upcoming shows, view live events, and see past results
          </p>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No events available. Check back later!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto">
            {events.map((event) => {
              const hasJoined = userJoins.has(event.id)
              const joinInfo = userJoins.get(event.id)

              return (
                <Card key={event.id} className="grid grid-rows-subgrid" style={{ gridRow: 'span 5' }}>
                  {/* Row 1: Title and Badge */}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg leading-tight flex-1 break-words">
                        {event.name}
                      </CardTitle>
                      <div className="shrink-0">
                        {getStatusBadge(event.status)}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Row 2: Date */}
                  <div className="px-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Row 3: Brand */}
                  <div className="px-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-medium shrink-0">Brand:</span>
                      <span className="truncate">{getBrandName(event.brandId)}</span>
                    </div>
                  </div>

                  {/* Row 4: Joined Status (or empty space) */}
                  <div className="px-6 pb-3">
                    {hasJoined && joinInfo ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <span className="text-sm">
                          Joined as{" "}
                          <Badge variant={joinInfo.mode === 'contrarian' ? 'destructive' : 'default'} className="text-xs">
                            {joinInfo.mode}
                          </Badge>
                        </span>
                      </div>
                    ) : (
                      <div className="h-0" />
                    )}
                  </div>

                  {/* Row 5: Button */}
                  <CardFooter className="pt-0">
                    {hasJoined ? (
                      <Button
                        className="w-full"
                        onClick={() => handleViewEvent(event.id)}
                      >
                        {event.status === 'completed' ? 'View Results' : 'View Predictions'}
                      </Button>
                    ) : event.status === 'completed' ? (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handleViewEvent(event.id)}
                      >
                        View Results
                      </Button>
                    ) : event.status === 'locked' ? (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => handleViewEvent(event.id)}
                      >
                        View Event
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setJoiningEventId(event.id)}
                        disabled={event.status !== 'open'}
                      >
                        {event.status === 'open' ? 'Join Event' : 'Not Available'}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {joiningEvent && (
        <JoinEventDialog
          event={joiningEvent}
          open={joiningEventId !== null}
          onOpenChange={(open) => !open && setJoiningEventId(null)}
          onSuccess={(join) => handleJoinSuccess(joiningEvent.id, join)}
        />
      )}
    </>
  )
}
