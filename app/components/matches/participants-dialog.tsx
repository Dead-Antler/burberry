"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, Crown, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { FuzzyCombobox, type FuzzyComboboxOption } from "@/components/ui/fuzzy-combobox"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { getParticipantName, groupParticipantsBySide } from "@/app/lib/participant-utils"
import { GroupBadge } from "@/app/components/ui/group-badge"
import type {
  MatchWithParticipants,
  MatchParticipantWithData,
  WrestlerWithGroups,
  Brand,
} from "@/app/lib/api-types"

interface ParticipantsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: MatchWithParticipants | null
  eventBrandId?: string
  onUpdate: () => void
}

type ParticipantType = "wrestler" | "group"

interface ParticipantOption extends FuzzyComboboxOption {
  type: ParticipantType
}

export function ParticipantsDialog({
  open,
  onOpenChange,
  match,
  eventBrandId,
  onUpdate,
}: ParticipantsDialogProps) {
  const [wrestlers, setWrestlers] = useState<WrestlerWithGroups[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [participants, setParticipants] = useState<MatchParticipantWithData[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [togglingChampionId, setTogglingChampionId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [explicitSides, setExplicitSides] = useState<number[]>([])

  const fetchParticipants = useCallback(async () => {
    if (!match) return
    try {
      const data = await apiClient.getMatch(match.id, { includeParticipants: true })
      if ("participants" in data) {
        setParticipants(data.participants)
      }
    } catch (err) {
      console.error("Failed to fetch participants:", err)
    }
  }, [match])

  useEffect(() => {
    if (open && match) {
      const fetchOptions = async () => {
        setIsLoadingOptions(true)
        try {
          const [wrestlersData, brandsData] = await Promise.all([
            apiClient.getAllWrestlers({ isActive: true, includeGroups: true }),
            apiClient.getBrands(),
          ])
          setWrestlers(wrestlersData as WrestlerWithGroups[])
          setBrands(brandsData)
        } catch (err) {
          console.error("Failed to load participants:", err)
        } finally {
          setIsLoadingOptions(false)
        }
      }
      fetchOptions()
      setParticipants(match.participants || [])
      fetchParticipants()
      setExplicitSides([])
      setError(null)
    }
  }, [open, match, fetchParticipants])

  // Group participants by side and compute side numbers
  const { participantsBySide, sideNumbers, maxSide } = useMemo(() => {
    const bySide = groupParticipantsBySide(participants)

    // Get sides from participants
    const fromParticipants = new Set(
      participants.map((p) => p.side).filter((s): s is number => s !== null)
    )

    // Merge with explicit sides
    const merged = new Set([...fromParticipants, ...explicitSides])

    // Ensure at least sides 1 and 2
    if (merged.size === 0) {
      merged.add(1)
      merged.add(2)
    } else if (merged.size === 1) {
      merged.add(merged.has(1) ? 2 : 1)
    }

    const sides = Array.from(merged).sort((a, b) => a - b)
    const max = Math.max(...sides, 0)

    // Ensure all sides have entries in the map
    for (const side of sides) {
      if (!bySide.has(side)) {
        bySide.set(side, [])
      }
    }

    return {
      participantsBySide: bySide,
      sideNumbers: sides,
      maxSide: max,
    }
  }, [participants, explicitSides])

  // Create brand lookup map
  const brandMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const brand of brands) {
      map.set(brand.id, brand.name)
    }
    return map
  }, [brands])

  // Create wrestler groups lookup map
  const wrestlerGroupsMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>()
    for (const wrestler of wrestlers) {
      map.set(wrestler.id, wrestler.groups)
    }
    return map
  }, [wrestlers])

  // All available options with type info and brand groups
  // Now only shows wrestlers (with their group memberships as searchable terms)
  const allOptions = useMemo(() => {
    const existingIds = new Set(participants.map((p) => p.participantId))

    const wrestlerOpts: ParticipantOption[] = wrestlers
      .filter((w) => !existingIds.has(w.id))
      .map((w) => ({
        value: w.id,
        label: w.currentName,
        type: "wrestler" as const,
        group: brandMap.get(w.brandId),
        warning: eventBrandId ? w.brandId !== eventBrandId : false,
        warningTooltip: "Different brand",
        // Add group names as searchable terms so typing "don callis" shows DCF members
        searchTerms: w.groups.map((g) => g.name),
        // Show group memberships below the wrestler name
        secondaryLabel: w.groups.length > 0
          ? w.groups.map((g) => g.name).join(", ")
          : undefined,
      }))

    return wrestlerOpts
  }, [wrestlers, participants, eventBrandId, brandMap])

  const handleAddToSide = async (
    sideNumber: number | null,
    participantType: ParticipantType,
    participantId: string,
    isChampion: boolean
  ) => {
    if (!match) return

    setError(null)
    try {
      await apiClient.addMatchParticipant(match.id, {
        participantType,
        participantId,
        side: sideNumber,
        isChampion,
      })
      await fetchParticipants()
      onUpdate()
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to add participant"
      setError(message)
    }
  }

  const handleRemove = async (participantId: string) => {
    if (!match) return

    setRemovingId(participantId)
    setError(null)

    try {
      await apiClient.removeMatchParticipant(match.id, participantId)
      await fetchParticipants()
      onUpdate()
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to remove participant"
      setError(message)
    } finally {
      setRemovingId(null)
    }
  }

  const handleToggleChampion = async (participant: MatchParticipantWithData) => {
    if (!match) return

    setTogglingChampionId(participant.id)
    setError(null)

    try {
      await apiClient.updateMatchParticipant(match.id, participant.id, {
        isChampion: !participant.isChampion,
      })
      // Optimistic update
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === participant.id ? { ...p, isChampion: !p.isChampion } : p
        )
      )
      onUpdate()
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to update champion status"
      setError(message)
      await fetchParticipants()
    } finally {
      setTogglingChampionId(null)
    }
  }

  const handleMoveParticipant = async (
    participantId: string,
    newSide: number | null
  ) => {
    if (!match) return

    setMovingId(participantId)
    setError(null)

    try {
      await apiClient.updateMatchParticipant(match.id, participantId, {
        side: newSide,
      })
      // Optimistic update
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === participantId ? { ...p, side: newSide } : p
        )
      )
      onUpdate()
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to move participant"
      setError(message)
      await fetchParticipants()
    } finally {
      setMovingId(null)
    }
  }

  const handleAddSide = () => {
    const nextSide = maxSide + 1
    setExplicitSides((prev) => [...prev, nextSide])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full max-w-none max-h-none sm:w-[80vw] sm:h-[80vh] sm:max-w-[80vw] sm:max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Participants</DialogTitle>
          <DialogDescription>
            {match?.matchType} — Match #{match?.matchOrder}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {isLoadingOptions ? (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Skeleton className="h-[200px] w-full sm:w-[calc(25%-0.75rem)]" />
              <Skeleton className="h-[200px] w-full sm:w-[calc(25%-0.75rem)]" />
            </div>
          ) : (
            <>
              {/* Side columns - stack on mobile, flex-wrap on desktop (max 4 per row) */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                {sideNumbers.map((sideNum) => (
                  <SideColumn
                    key={sideNum}
                    sideNumber={sideNum}
                    participants={participantsBySide.get(sideNum) ?? []}
                    allOptions={allOptions}
                    onAddParticipant={handleAddToSide}
                    onRemoveParticipant={handleRemove}
                    onToggleChampion={handleToggleChampion}
                    onMoveParticipant={handleMoveParticipant}
                    allSides={sideNumbers}
                    removingId={removingId}
                    togglingChampionId={togglingChampionId}
                    movingId={movingId}
                    wrestlerGroupsMap={wrestlerGroupsMap}
                  />
                ))}

                {/* Add Side button */}
                <Card className="w-full sm:flex-1 sm:min-w-50 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center h-full py-6">
                    <Button
                      variant="ghost"
                      className="flex flex-col gap-2 h-auto py-3"
                      onClick={handleAddSide}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-sm">Add Side {maxSide + 1}</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

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

function SideColumn({
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

function ParticipantCard({
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
              {/* Move to other sides */}
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
