"use client"

import { useState } from "react"
import { Lock, Unlock, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { WrestlerSearchSelect } from "../predictions/wrestler-search-select"
import type { MatchWithParticipants } from "@/app/lib/api-types"
import { getParticipantDisplayName } from "@/app/lib/api-types"

interface MatchAdminControlsProps {
  match: MatchWithParticipants
  eventStatus: string
  onUpdate: (data: {
    isLocked?: boolean
    winningSide?: number | null
    winnerParticipantId?: string | null
    outcome?: string
  }) => Promise<void>
}

export function MatchAdminControls({ match, eventStatus, onUpdate }: MatchAdminControlsProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const canLock = eventStatus === 'open' || eventStatus === 'locked'
  const canSetResults = eventStatus === 'locked'
  const hasNoParticipants = match.participants.length === 0
  const isTeamMatch = match.participants.some((p) => p.side !== null)

  // Get all unique sides
  const sides = isTeamMatch
    ? Array.from(new Set(match.participants.map((p) => p.side).filter((s) => s !== null))) as number[]
    : []

  // Get participants for a side
  const getSideParticipants = (side: number) => {
    return match.participants
      .filter((p) => p.side === side)
      .map((p) => getParticipantDisplayName(p.participant))
  }

  // Render side label
  const renderSideLabel = (side: number) => {
    const names = getSideParticipants(side)
    return names.join(' & ')
  }

  const handleLockToggle = async () => {
    setIsUpdating(true)
    try {
      await onUpdate({ isLocked: !match.isLocked })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSetWinner = async (side?: number, participantId?: string, wrestlerId?: string) => {
    setIsUpdating(true)
    try {
      await onUpdate({
        winningSide: side ?? null,
        winnerParticipantId: participantId || wrestlerId || null,
        outcome: 'winner',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  // Don't show admin controls if there's nothing to control
  if (!canLock && !canSetResults) {
    return null
  }

  return (
    <div className="border-t pt-3 mt-3 space-y-3 bg-neutral-50 dark:bg-neutral-950 -m-4 p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1">
          <Trophy className="h-3 w-3" />
          Admin Controls
        </span>
      </div>

      <div className="grid gap-3">
        {/* Lock/Unlock Match */}
        {canLock && (
          <div className="flex items-center justify-between">
            <Label htmlFor={`lock-${match.id}`} className="text-sm">
              {match.isLocked ? (
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Match Locked
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Unlock className="h-3.5 w-3.5" />
                  Match Unlocked
                </span>
              )}
            </Label>
            <Switch
              id={`lock-${match.id}`}
              checked={match.isLocked}
              onCheckedChange={handleLockToggle}
              disabled={isUpdating}
            />
          </div>
        )}

        {/* Set Winner */}
        {canSetResults && (
          <div className="space-y-2">
            <Label className="text-sm">Set Winner</Label>

            {/* Match with no participants: Wrestler search */}
            {hasNoParticipants ? (
              <div className="space-y-2">
                <WrestlerSearchSelect
                  value={match.winnerParticipantId ?? ''}
                  onValueChange={(wrestlerId) => handleSetWinner(undefined, undefined, wrestlerId)}
                  disabled={isUpdating}
                  placeholder="Select winning wrestler..."
                />
                {match.winnerParticipantId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetWinner(undefined, undefined, '')}
                    disabled={isUpdating}
                  >
                    Clear Winner
                  </Button>
                )}
              </div>
            ) : /* Team Match: Select Side */
            isTeamMatch ? (
              <div className="space-y-2">
                <Select
                  value={match.winningSide?.toString() ?? 'none'}
                  onValueChange={(val) => val !== 'none' && handleSetWinner(parseInt(val))}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select winning side..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sides.sort((a, b) => a - b).map((side) => (
                      <SelectItem key={side} value={side.toString()}>
                        {renderSideLabel(side)}
                        {match.winningSide === side && ' ✓'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {match.winningSide !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetWinner(undefined, undefined, '')}
                    disabled={isUpdating}
                  >
                    Clear Winner
                  </Button>
                )}
              </div>
            ) : (
              /* Free-for-all: Select Participant */
              <div className="space-y-2">
                <Select
                  value={match.winnerParticipantId ?? 'none'}
                  onValueChange={(participantId) => participantId !== 'none' && handleSetWinner(undefined, participantId)}
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select winner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {match.participants.map((p) => {
                      const name = getParticipantDisplayName(p.participant)
                      return (
                        <SelectItem key={p.id} value={p.participantId}>
                          {name}
                          {p.entryOrder && ` (#${p.entryOrder})`}
                          {p.isChampion && ' (c)'}
                          {match.winnerParticipantId === p.participantId && ' ✓'}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {match.winnerParticipantId !== null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetWinner(undefined, '')}
                    disabled={isUpdating}
                  >
                    Clear Winner
                  </Button>
                )}
              </div>
            )}

            {match.outcome === 'winner' && (match.winningSide !== null || match.winnerParticipantId !== null) && (
              <Badge variant="default" className="text-xs">
                Winner Set
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
