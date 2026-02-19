"use client"

import { useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Event, EventJoin, EventJoinMode, MatchWithParticipants, Wrestler, Group } from "@/app/lib/api-types"
import { getParticipantDisplayName } from "@/app/lib/api-types"

interface JoinEventDialogProps {
  event: Event
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (join: EventJoin) => void
}

export function JoinEventDialog({
  event,
  open,
  onOpenChange,
  onSuccess,
}: JoinEventDialogProps) {
  const [mode, setMode] = useState<EventJoinMode>('normal')
  const [matches, setMatches] = useState<MatchWithParticipants[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch matches when dialog opens
  useEffect(() => {
    if (open) {
      setMode('normal')
      setError(null)
      fetchMatches()
    }
  }, [open])

  const fetchMatches = async () => {
    setIsLoadingMatches(true)
    try {
      const eventData = await apiClient.getEvent(event.id, { includeMatches: true })
      setMatches(eventData.matches || [])
    } catch (err) {
      console.error('Failed to load matches:', err)
      setMatches([])
    } finally {
      setIsLoadingMatches(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const join = await apiClient.joinEvent(event.id, { mode })
      onSuccess(join)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to join event"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderParticipants = (match: MatchWithParticipants) => {
    if (!match.participants || match.participants.length === 0) {
      return <span className="text-muted-foreground">TBA</span>
    }

    // Group by side for team matches
    const hasSides = match.participants.some((p) => p.side !== null)

    if (hasSides) {
      const sides = match.participants.reduce((acc, p) => {
        const side = p.side ?? 0
        if (!acc[side]) acc[side] = []
        acc[side].push(p.participant)
        return acc
      }, {} as Record<number, (Wrestler | Group)[]>)

      return Object.entries(sides)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, participants]) => (
          participants.map((p) => getParticipantDisplayName(p)).join(' & ')
        ))
        .join(' vs ')
    }

    // Free-for-all
    return match.participants
      .map((p) => getParticipantDisplayName(p.participant))
      .join(' vs ')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Join {event.name}</DialogTitle>
          <DialogDescription>
            Choose your prediction mode and join the event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match Preview */}
          <div>
            <h4 className="text-sm font-medium mb-2">Matches</h4>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-4 space-y-2">
                {isLoadingMatches ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Loading matches...
                  </p>
                ) : matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center">
                    No matches added yet
                  </p>
                ) : (
                  matches.map((match) => (
                    <div key={match.id} className="text-sm">
                      <span className="font-medium">Match {match.matchOrder}:</span>{' '}
                      <span className="text-muted-foreground">{renderParticipants(match)}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Mode Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Prediction Mode
            </Label>
            <RadioGroup value={mode} onValueChange={(val) => setMode(val as EventJoinMode)}>
              <label htmlFor="normal" className="flex items-start space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="normal" id="normal" className="mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="cursor-pointer font-medium text-sm">
                    Normal Mode
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Predict match winners and earn points for correct predictions.
                    Standard scoring applies.
                  </p>
                </div>
              </label>

              <label htmlFor="contrarian" className="flex items-start space-x-2 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="contrarian" id="contrarian" className="mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="cursor-pointer font-medium text-sm text-destructive">
                    Contrarian Mode
                  </span>
                  <p className="text-sm text-muted-foreground">
                    Try to get <strong>ALL</strong> match predictions wrong.
                    If you achieve this, you automatically win the event regardless of points!
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {mode === 'contrarian' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Contrarian mode is high risk, high reward. You must get <strong>every single match</strong> wrong to win.
                Even one correct prediction means you lose!
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Joining...' : 'Join Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
