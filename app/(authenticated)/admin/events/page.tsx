"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { EventsTable } from "@/app/components/events/events-table"
import { EventDialog } from "@/app/components/events/event-dialog"
import { DeleteEventDialog } from "@/app/components/events/delete-event-dialog"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Event, Brand } from "@/app/lib/api-types"

export default function ManageEventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [eventsData, brandsData] = await Promise.all([
        apiClient.getEvents(),
        apiClient.getBrands(),
      ])
      setEvents(eventsData)
      setBrands(brandsData)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load data"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateSuccess = (event: Event) => {
    setEvents((prev) => [...prev, event])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updatedEvent: Event) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    )
    setEditingEvent(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== deletedId))
    setDeletingEvent(null)
  }

  // Create a map for quick brand name lookup
  const brandMap = new Map(brands.map((b) => [b.id, b.name]))

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Manage Events" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Manage Events</h1>
            <p className="text-muted-foreground">
              Create and manage wrestling events.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Button>
        </div>

        <EventsTable
          events={events}
          brandMap={brandMap}
          isLoading={isLoading}
          error={error}
          onEdit={setEditingEvent}
          onDelete={setDeletingEvent}
          onRetry={fetchData}
        />

        <EventDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          brands={brands}
          onSuccess={handleCreateSuccess}
        />

        <EventDialog
          open={editingEvent !== null}
          onOpenChange={(open) => !open && setEditingEvent(null)}
          event={editingEvent}
          brands={brands}
          onSuccess={handleEditSuccess}
        />

        <DeleteEventDialog
          open={deletingEvent !== null}
          onOpenChange={(open) => !open && setDeletingEvent(null)}
          event={deletingEvent}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </>
  )
}
