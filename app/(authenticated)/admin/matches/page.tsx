"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MatchesTable } from "@/app/components/matches/matches-table"
import { MatchDialog } from "@/app/components/matches/match-dialog"
import { DeleteMatchDialog } from "@/app/components/matches/delete-match-dialog"
import { ParticipantsDialog } from "@/app/components/matches/participants-dialog"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Event, Match, MatchWithParticipants, EventWithMatches } from "@/app/lib/api-types"

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default function ManageMatchesPage() {
  const searchParams = useSearchParams()
  const eventIdFromUrl = searchParams.get("eventId")

  const [activeEvents, setActiveEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [matches, setMatches] = useState<MatchWithParticipants[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingMatch, setEditingMatch] = useState<MatchWithParticipants | null>(null)
  const [deletingMatch, setDeletingMatch] = useState<MatchWithParticipants | null>(null)
  const [participantsMatch, setParticipantsMatch] = useState<MatchWithParticipants | null>(null)

  // Fetch active events on mount (open + locked only, filtered server-side)
  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoadingEvents(true)
      try {
        const data = await apiClient.getEvents({ active: true })
        setActiveEvents(data)

        // If coming from URL, fetch that specific event (may be completed)
        if (eventIdFromUrl) {
          try {
            const event = await apiClient.getEvent(eventIdFromUrl)
            setSelectedEvent(event)
          } catch {
            // Event not found, ignore
          }
        }
      } catch (err) {
        const message = err instanceof ApiClientError
          ? err.message
          : "Failed to load events"
        setError(message)
      } finally {
        setIsLoadingEvents(false)
      }
    }
    fetchEvents()
  }, [eventIdFromUrl])

  // Fetch matches when event is selected
  const fetchMatches = useCallback(async () => {
    if (!selectedEvent) {
      setMatches([])
      return
    }

    setIsLoadingMatches(true)
    setError(null)
    try {
      const event = await apiClient.getEvent(selectedEvent.id, {
        includeMatches: true,
      }) as EventWithMatches
      setMatches(event.matches || [])
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load matches"
      setError(message)
    } finally {
      setIsLoadingMatches(false)
    }
  }, [selectedEvent])

  useEffect(() => {
    fetchMatches()
  }, [fetchMatches])

  const handleEventChange = (eventId: string) => {
    const event = activeEvents.find((e) => e.id === eventId)
    setSelectedEvent(event || null)
  }

  const handleCreateSuccess = (match: Match) => {
    // Refetch to get full match with participants
    fetchMatches()
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updatedMatch: Match) => {
    // Refetch to get updated match with participants
    fetchMatches()
    setEditingMatch(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setMatches((prev) => prev.filter((m) => m.id !== deletedId))
    setDeletingMatch(null)
  }

  const isEventEditable = selectedEvent?.status === "open" || selectedEvent?.status === "locked"

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Manage Events", href: "/admin/events" },
          { label: "Matches" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Manage Matches</h1>
            <p className="text-muted-foreground">
              Create and manage matches for events.
            </p>
          </div>
          {selectedEvent && isEventEditable && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Match
            </Button>
          )}
        </div>

        {/* Event Selector */}
        <Card className="py-0">
          <CardContent className="py-4">
            <div className="space-y-2">
              <Label htmlFor="event-select">Select an open or locked event</Label>
              <Select
                value={selectedEvent?.id ?? ""}
                onValueChange={handleEventChange}
                disabled={isLoadingEvents}
              >
                <SelectTrigger id="event-select" className="w-full sm:w-[350px]">
                  <SelectValue placeholder={isLoadingEvents ? "Loading events..." : "Select an event..."} />
                </SelectTrigger>
                <SelectContent>
                  {activeEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} — {formatDate(event.eventDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeEvents.length === 0 && !isLoadingEvents && (
                <p className="text-sm text-muted-foreground">
                  No open or locked events available.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Event Header - shown when an event is selected */}
        {selectedEvent && (
          <Card className="py-0">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedEvent.name}</h2>
                  <p className="text-muted-foreground">
                    {formatDate(selectedEvent.eventDate)}
                  </p>
                </div>
                <Badge
                  variant={
                    selectedEvent.status === "open"
                      ? "default"
                      : selectedEvent.status === "locked"
                        ? "secondary"
                        : "outline"
                  }
                  className="capitalize"
                >
                  {selectedEvent.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedEvent ? (
          <MatchesTable
            matches={matches}
            isLoading={isLoadingMatches}
            error={error}
            onEdit={setEditingMatch}
            onDelete={setDeletingMatch}
            onManageParticipants={setParticipantsMatch}
            onRetry={fetchMatches}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">
                Select an event to manage its matches.
              </p>
            </CardContent>
          </Card>
        )}

        <MatchDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          eventId={selectedEvent?.id ?? ""}
          nextOrder={matches.length + 1}
          onSuccess={handleCreateSuccess}
        />

        <MatchDialog
          open={editingMatch !== null}
          onOpenChange={(open) => !open && setEditingMatch(null)}
          eventId={selectedEvent?.id ?? ""}
          match={editingMatch}
          onSuccess={handleEditSuccess}
        />

        <DeleteMatchDialog
          open={deletingMatch !== null}
          onOpenChange={(open) => !open && setDeletingMatch(null)}
          match={deletingMatch}
          onSuccess={handleDeleteSuccess}
        />

        <ParticipantsDialog
          open={participantsMatch !== null}
          onOpenChange={(open) => !open && setParticipantsMatch(null)}
          match={participantsMatch}
          eventBrandId={selectedEvent?.brandId}
          onUpdate={() => {
            // Refetch matches to get updated participants
            fetchMatches()
          }}
        />
      </div>
    </>
  )
}
