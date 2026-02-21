"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Event, Brand, EventStatus } from "@/app/lib/api-types"

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: Event | null
  brands: Brand[]
  onSuccess: (event: Event) => void
}

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "open", label: "Open" },
  { value: "locked", label: "Locked" },
  { value: "completed", label: "Completed" },
]

// Valid status transitions (current status -> allowed next statuses)
const VALID_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  pending: ["pending", "open"],
  open: ["open", "locked"],
  locked: ["locked", "completed"],
  completed: ["completed"],
}

function formatDateForInput(date: Date | string): string {
  const d = new Date(date)
  return d.toISOString().split("T")[0]
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  brands,
  onSuccess,
}: EventDialogProps) {
  const [name, setName] = useState("")
  const [brandId, setBrandId] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [status, setStatus] = useState<EventStatus>("pending")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = event !== null && event !== undefined

  // Reset form when dialog opens/closes or event changes
  useEffect(() => {
    if (open) {
      setName(event?.name ?? "")
      setBrandId(event?.brandId ?? (brands[0]?.id ?? ""))
      setEventDate(event ? formatDateForInput(event.eventDate) : "")
      setStatus(event?.status ?? "pending")
      setError(null)
    }
  }, [open, event, brands])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Event name is required")
      return
    }
    if (!brandId) {
      setError("Brand is required")
      return
    }
    if (!eventDate) {
      setError("Event date is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: Event
      if (isEditing) {
        result = await apiClient.updateEvent(event.id, {
          name: trimmedName,
          brandId,
          eventDate: new Date(eventDate).toISOString(),
          status,
        })
      } else {
        result = await apiClient.createEvent({
          name: trimmedName,
          brandId,
          eventDate: new Date(eventDate).toISOString(),
          status,
        })
      }
      onSuccess(result)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : isEditing
          ? "Failed to update event"
          : "Failed to create event"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Event" : "Create Event"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the event details below."
                : "Enter details for the new event."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-brand">Brand</Label>
              <Select
                value={brandId}
                onValueChange={setBrandId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="event-brand">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-name">Name</Label>
              <Input
                id="event-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., WrestleMania 42"
                maxLength={200}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as EventStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="event-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter((option) =>
                    isEditing
                      ? VALID_TRANSITIONS[event.status].includes(option.value)
                      : true
                  ).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
