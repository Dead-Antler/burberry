"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Users, ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useSession } from "@/app/lib/auth-client"
import { MatchPredictionCard } from "@/app/components/predictions/match-prediction-card"
import { EventAdminControls } from "@/app/components/events/event-admin-controls"
import { EventLeaderboard } from "./event-leaderboard"
import { useEventData } from "./use-event-data"
import { useLeaderboardAnimation } from "./use-leaderboard-animation"

export default function EventPredictionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = use(params)
  const router = useRouter()
  const { data: session } = useSession()

  const {
    event,
    setEvent,
    matches,
    participants,
    userJoin,
    userPredictions,
    predictionStats,
    leaderboard,
    activeTab,
    setActiveTab,
    isLoading,
    error,
    isAnimating,
    setIsAnimating,
    handlePredictionChange,
    handleMatchUpdate,
    handleCreateSurpriseMatch,
  } = useEventData(eventId)

  const {
    isAnimating: animating,
    visibleCount,
    hasAnimated,
    startAnimation,
  } = useLeaderboardAnimation(leaderboard, isAnimating, setIsAnimating)

  const isAdmin = session?.user?.role === 'admin'

  if (isLoading) {
    return (
      <>
        <SiteHeader breadcrumbs={[
          { label: "Events", href: "/events" },
          { label: "Loading..." },
        ]} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    )
  }

  if (error || !event) {
    return (
      <>
        <SiteHeader breadcrumbs={[
          { label: "Events", href: "/events" },
          { label: "Error" },
        ]} />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Alert variant="destructive">
            <AlertDescription>{error || "Event not found"}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push('/events')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </div>
      </>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'open':
        return <Badge variant="default">Open</Badge>
      case 'locked':
        return <Badge variant="destructive">Locked</Badge>
      case 'completed':
        return <Badge variant="outline">Completed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const isLocked = event.status === 'locked' || event.status === 'completed'

  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Events", href: "/events" },
        { label: event.name },
      ]} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Event Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <CardTitle className="text-2xl">{event.name}</CardTitle>
                <CardDescription className="flex items-center gap-4">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {new Date(event.eventDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {participants.length} participants
                  </span>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {getStatusBadge(event.status)}
                {userJoin && (
                  <Badge variant={userJoin.mode === 'contrarian' ? 'destructive' : 'default'}>
                    {userJoin.mode === 'contrarian' ? 'Contrarian' : 'Normal'} Mode
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Participants */}
            <div>
              <h3 className="text-sm font-medium mb-2">Participants</h3>
              <div className="flex gap-2 flex-wrap">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {p.user.name?.[0]?.toUpperCase() || p.user.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{p.user.name || p.user.email}</span>
                    {p.mode === 'contrarian' && (
                      <Badge variant="destructive" className="text-xs">C</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Controls */}
        {isAdmin && (
          <EventAdminControls
            event={event}
            onEventUpdate={setEvent}
            onSurpriseMatch={handleCreateSurpriseMatch}
            matchCount={matches.length}
          />
        )}

        {/* Tabbed Content: Matches and Results */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          {/* Matches Tab */}
          <TabsContent value="matches">
            <Card>
              <CardHeader>
                <CardTitle>Matches</CardTitle>
                <CardDescription>
                  {isLocked
                    ? "Predictions are locked. Results will be available soon."
                    : "Make your predictions for each match"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {matches.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No matches added yet
                    </div>
                  ) : (
                    matches
                      .sort((a, b) => a.matchOrder - b.matchOrder)
                      .map((match) => (
                        <MatchPredictionCard
                          key={match.id}
                          match={match}
                          userPrediction={userPredictions.get(match.id)}
                          stats={predictionStats?.matches.find((m) => m.matchId === match.id)}
                          hidePredictors={event.hidePredictors}
                          isLocked={match.isLocked || event.status === 'completed'}
                          isAdmin={isAdmin}
                          eventStatus={event.status}
                          onPredictionChange={async (data) => await handlePredictionChange(match.id, data)}
                          onMatchUpdate={handleMatchUpdate}
                        />
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results">
            <EventLeaderboard
              event={event}
              leaderboard={leaderboard}
              participants={participants}
              currentUserId={session?.user?.id}
              isAnimating={animating}
              visibleCount={visibleCount}
              hasAnimated={hasAnimated}
              onReplay={startAnimation}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
