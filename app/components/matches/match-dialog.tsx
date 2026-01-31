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
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Match, MatchWithParticipants } from "@/app/lib/api-types"

interface MatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  match?: MatchWithParticipants | null
  nextOrder?: number
  onSuccess: (match: Match) => void
}

const COMMON_MATCH_TYPES = [
  "Singles",
  "Tag Team",
  "Triple Threat",
  "Fatal 4-Way",
  "6-Pack Challenge",
  "Battle Royal",
  "Royal Rumble",
  "Ladder",
  "Tables",
  "TLC",
  "Steel Cage",
  "Hell in a Cell",
  "Elimination Chamber",
  "Iron Man",
  "Last Man Standing",
  "I Quit",
  "Handicap",
]

export function MatchDialog({
  open,
  onOpenChange,
  eventId,
  match,
  nextOrder = 1,
  onSuccess,
}: MatchDialogProps) {
  const [matchType, setMatchType] = useState("")
  const [matchOrder, setMatchOrder] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = match !== null && match !== undefined

  // Reset form when dialog opens/closes or match changes
  useEffect(() => {
    if (open) {
      setMatchType(match?.matchType ?? "Singles")
      setMatchOrder(match?.matchOrder ?? nextOrder)
      setError(null)
    }
  }, [open, match, nextOrder])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedType = matchType.trim()
    if (!trimmedType) {
      setError("Match type is required")
      return
    }
    if (matchOrder < 1) {
      setError("Match order must be at least 1")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: Match
      if (isEditing) {
        result = await apiClient.updateMatch(match.id, {
          matchType: trimmedType,
          matchOrder,
        })
      } else {
        result = await apiClient.createMatch({
          eventId,
          matchType: trimmedType,
          matchOrder,
          participants: [], // Participants added separately
        })
      }
      onSuccess(result)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : isEditing
          ? "Failed to update match"
          : "Failed to create match"
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
              {isEditing ? "Edit Match" : "Create Match"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the match details below."
                : "Enter details for the new match. Participants can be added after creating the match."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="match-type">Match Type</Label>
              <Input
                id="match-type"
                value={matchType}
                onChange={(e) => setMatchType(e.target.value)}
                placeholder="e.g., Singles, Tag Team"
                list="match-types"
                maxLength={100}
                autoFocus
                disabled={isSubmitting}
              />
              <datalist id="match-types">
                {COMMON_MATCH_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-order">Match Order</Label>
              <Input
                id="match-order"
                type="number"
                min={1}
                value={matchOrder}
                onChange={(e) => setMatchOrder(parseInt(e.target.value) || 1)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Position in the event card (1 = first match)
              </p>
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
                  : "Create Match"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
