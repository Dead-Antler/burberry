"use client"

import { useState } from "react"
import { ArrowRightLeft, Crown, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FuzzyCombobox } from "@/components/ui/fuzzy-combobox"
import { Badge } from "@/components/ui/badge"
import { getParticipantName } from "@/app/lib/participant-utils"
import { GroupBadge } from "@/app/components/ui/group-badge"
import type { MatchParticipantWithData } from "@/app/lib/api-types"
import type { ParticipantType, ParticipantOption } from "./use-participant-management"

// ============================================================================
// SideColumn Component
// ============================================================================

interface SideColumnProps {
  sideNumber: number
  participants: MatchParticipantWithData[]
  allOptions: ParticipantOption[]
  onAddParticipant: (
    side: number | null,
    type: ParticipantType,
    id: string,
    isChampion: boolean
  ) => Promise<void>
  onRemoveParticipant: (id: string) => Promise<void>
  onToggleChampion: (p: MatchParticipantWithData) => Promise<void>
  onMoveParticipant: (id: string, newSide: number | null) => Promise<void>
  allSides: number[]
  removingId: string | null
  togglingChampionId: string | null
  movingId: string | null
  wrestlerGroupsMap: Map<string, Array<{ id: string; name: string }>>
}

export function SideColumn({
  sideNumber,
  participants,
  allOptions,
  onAddParticipant,
  onRemoveParticipant,
  onToggleChampion,
  onMoveParticipant,
  allSides,
  removingId,
  togglingChampionId,
  movingId,
  wrestlerGroupsMap,
}: SideColumnProps) {
  const [selectedId, setSelectedId] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async () => {
    if (!selectedId) return
    const selected = allOptions.find((o) => o.value === selectedId)
    if (!selected) return

    setIsAdding(true)
    try {
      await onAddParticipant(sideNumber, selected.type, selectedId, false)
      setSelectedId("")
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Card className="w-full sm:w-[calc(25%-0.5625rem)] sm:min-w-50">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Side {sideNumber}</span>
          <Badge variant="secondary" className="text-xs">
            {participants.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Participant list */}
        <div className="space-y-2 min-h-[60px]">
          {participants.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">
              No participants
            </p>
          ) : (
            participants.map((participant) => (
              <ParticipantCard
                key={participant.id}
                participant={participant}
                onRemove={() => onRemoveParticipant(participant.id)}
                onToggleChampion={() => onToggleChampion(participant)}
                onMove={(newSide) => onMoveParticipant(participant.id, newSide)}
                currentSide={sideNumber}
                allSides={allSides}
                isRemoving={removingId === participant.id}
                isTogglingChampion={togglingChampionId === participant.id}
                isMoving={movingId === participant.id}
                groups={
                  participant.participantType === "wrestler"
                    ? wrestlerGroupsMap.get(participant.participantId) || []
                    : []
                }
              />
            ))
          )}
        </div>

        {/* Add participant form */}
        <div className="border-t pt-3 flex gap-2 items-center">
          <FuzzyCombobox
            options={allOptions}
            value={selectedId}
            onValueChange={setSelectedId}
            placeholder="Add participant..."
            searchPlaceholder="Search wrestlers or groups..."
            emptyMessage="None available"
            className="flex-1 min-w-0"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleAdd}
            disabled={!selectedId || isAdding}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// ParticipantCard Component
// ============================================================================

interface ParticipantCardProps {
  participant: MatchParticipantWithData
  onRemove: () => void
  onToggleChampion: () => void
  onMove: (newSide: number | null) => void
  currentSide: number | null
  allSides: number[]
  isRemoving: boolean
  isTogglingChampion: boolean
  isMoving: boolean
  groups: Array<{ id: string; name: string }>
}

export function ParticipantCard({
  participant,
  onRemove,
  onToggleChampion,
  onMove,
  currentSide,
  allSides,
  isRemoving,
  isTogglingChampion,
  isMoving,
  groups,
}: ParticipantCardProps) {
  const name = getParticipantName(participant)
  const isLoading = isRemoving || isTogglingChampion || isMoving

  return (
    <div className="flex items-center gap-1.5 p-2 rounded-md border bg-card text-card-foreground">
      {/* Champion toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onToggleChampion}
        disabled={isLoading}
        aria-label={participant.isChampion ? "Remove champion" : "Set champion"}
      >
        {isTogglingChampion ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Crown
            className={
              participant.isChampion
                ? "h-3 w-3 text-yellow-500 fill-yellow-500"
                : "h-3 w-3 text-muted-foreground"
            }
          />
        )}
      </Button>

      {/* Name and groups */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {groups.map((g) => (
              <GroupBadge key={g.id} groupName={g.name} size="sm" />
            ))}
          </div>
        )}
      </div>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            disabled={isLoading}
          >
            {isMoving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MoreHorizontal className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Move to...
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {allSides
                .filter((s) => s !== currentSide)
                .map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onMove(s)}>
                    Side {s}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onRemove}
            disabled={isRemoving}
            className="text-destructive focus:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
