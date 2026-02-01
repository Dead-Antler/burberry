"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Crown, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { FuzzyCombobox, type FuzzyComboboxOption } from "@/components/ui/fuzzy-combobox"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { GroupBadge } from "@/app/components/ui/group-badge"
import type { Match, MatchWithParticipants, WrestlerWithGroups, Brand } from "@/app/lib/api-types"

type ParticipantType = "wrestler" | "group"

interface LocalParticipant {
  id: string // Temporary ID for local state
  participantType: ParticipantType
  participantId: string
  participantName: string
  side: number | null
  isChampion: boolean
  groups?: Array<{ id: string; name: string }>
}

interface ParticipantOption extends FuzzyComboboxOption {
  type: ParticipantType
}

interface MatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventBrandId?: string
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
  eventBrandId,
  match,
  nextOrder = 1,
  onSuccess,
}: MatchDialogProps) {
  const [matchType, setMatchType] = useState("")
  const [unknownParticipants, setUnknownParticipants] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Participant management state (for create mode only)
  const [wrestlers, setWrestlers] = useState<WrestlerWithGroups[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [localParticipants, setLocalParticipants] = useState<LocalParticipant[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [explicitSides, setExplicitSides] = useState<number[]>([])

  const isEditing = match !== null && match !== undefined

  // Fetch wrestlers and brands when dialog opens in create mode
  const fetchOptions = useCallback(async () => {
    if (isEditing) return
    setIsLoadingOptions(true)
    try {
      const [wrestlersData, brandsData] = await Promise.all([
        apiClient.getAllWrestlers({ isActive: true, includeGroups: true }),
        apiClient.getBrands(),
      ])
      setWrestlers(wrestlersData as WrestlerWithGroups[])
      setBrands(brandsData)
    } catch (err) {
      console.error("Failed to load wrestlers:", err)
    } finally {
      setIsLoadingOptions(false)
    }
  }, [isEditing])

  // Reset form when dialog opens/closes or match changes
  useEffect(() => {
    if (open) {
      setMatchType(match?.matchType ?? "Singles")
      setUnknownParticipants(match?.unknownParticipants ?? false)
      setLocalParticipants([])
      setExplicitSides([])
      setError(null)
      fetchOptions()
    }
  }, [open, match, fetchOptions])

  // Create brand lookup map
  const brandMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const brand of brands) {
      map.set(brand.id, brand.name)
    }
    return map
  }, [brands])

  // Group participants by side and compute side numbers
  const { participantsBySide, sideNumbers, maxSide } = useMemo(() => {
    const bySide = new Map<number, LocalParticipant[]>()

    for (const p of localParticipants) {
      const side = p.side ?? 0
      if (!bySide.has(side)) {
        bySide.set(side, [])
      }
      bySide.get(side)!.push(p)
    }

    // Get sides from participants
    const fromParticipants = new Set(
      localParticipants.map((p) => p.side).filter((s): s is number => s !== null)
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
  }, [localParticipants, explicitSides])

  // All available options with type info and brand groups
  const allOptions = useMemo(() => {
    const existingIds = new Set(localParticipants.map((p) => p.participantId))

    const wrestlerOpts: ParticipantOption[] = wrestlers
      .filter((w) => !existingIds.has(w.id))
      .map((w) => ({
        value: w.id,
        label: w.currentName,
        type: "wrestler" as const,
        group: brandMap.get(w.brandId),
        warning: eventBrandId ? w.brandId !== eventBrandId : false,
        warningTooltip: "Different brand",
        searchTerms: w.groups.map((g) => g.name),
        secondaryLabel: w.groups.length > 0
          ? w.groups.map((g) => g.name).join(", ")
          : undefined,
      }))

    return wrestlerOpts
  }, [wrestlers, localParticipants, eventBrandId, brandMap])

  // Handlers for local participant management
  const handleAddToSide = (sideNumber: number, participantId: string) => {
    const wrestler = wrestlers.find((w) => w.id === participantId)
    if (!wrestler) return

    const newParticipant: LocalParticipant = {
      id: crypto.randomUUID(),
      participantType: "wrestler",
      participantId: wrestler.id,
      participantName: wrestler.currentName,
      side: sideNumber,
      isChampion: false,
      groups: wrestler.groups,
    }

    setLocalParticipants((prev) => [...prev, newParticipant])
  }

  const handleRemoveParticipant = (id: string) => {
    setLocalParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  const handleToggleChampion = (id: string) => {
    setLocalParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isChampion: !p.isChampion } : p))
    )
  }

  const handleAddSide = () => {
    const nextSide = maxSide + 1
    setExplicitSides((prev) => [...prev, nextSide])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedType = matchType.trim()
    if (!trimmedType) {
      setError("Match type is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: Match
      if (isEditing) {
        // Don't update matchOrder here - use drag and drop to reorder
        result = await apiClient.updateMatch(match.id, {
          matchType: trimmedType,
          unknownParticipants,
        })
      } else {
        // Convert local participants to API format
        const participants = localParticipants.map((p) => ({
          side: p.side,
          participantType: p.participantType,
          participantId: p.participantId,
          isChampion: p.isChampion,
        }))

        // New matches are added at the end - use drag and drop to reorder
        result = await apiClient.createMatch({
          eventId,
          matchType: trimmedType,
          matchOrder: nextOrder,
          unknownParticipants,
          participants,
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
      <DialogContent className={isEditing ? "sm:max-w-[425px]" : "sm:max-w-4xl max-h-[90vh] flex flex-col"}>
        <form onSubmit={handleSubmit} className={isEditing ? "" : "flex flex-col flex-1 min-h-0"}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Match" : "Create Match"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the match details below."
                : "Enter match details and optionally add participants."}
            </DialogDescription>
          </DialogHeader>
          <div className={isEditing ? "grid gap-4 py-4" : "flex-1 min-h-0 overflow-y-auto py-4 space-y-6"}>
            {/* Match details section */}
            <div className="grid gap-4">
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
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="unknown-participants"
                  checked={unknownParticipants}
                  onCheckedChange={(checked) => setUnknownParticipants(checked === true)}
                  disabled={isSubmitting}
                />
                <div className="space-y-1 leading-none">
                  <Label htmlFor="unknown-participants" className="cursor-pointer">
                    Unknown participants
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Predictors can enter their own winner selection
                  </p>
                </div>
              </div>
              {isEditing && unknownParticipants && !match.unknownParticipants && match.participants && match.participants.length > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-500">
                  This match has {match.participants.length} participant{match.participants.length > 1 ? "s" : ""}.
                  They will be hidden while &quot;Unknown participants&quot; is enabled.
                </p>
              )}
            </div>

            {/* Participants section (create mode only) */}
            {!isEditing && !unknownParticipants && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Participants</Label>
                  <span className="text-xs text-muted-foreground">
                    {localParticipants.length} added
                  </span>
                </div>

                {isLoadingOptions ? (
                  <div className="flex gap-3">
                    <div className="flex-1 h-40 bg-muted/50 rounded-lg animate-pulse" />
                    <div className="flex-1 h-40 bg-muted/50 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {sideNumbers.map((sideNum) => (
                      <SideColumnLocal
                        key={sideNum}
                        sideNumber={sideNum}
                        participants={participantsBySide.get(sideNum) ?? []}
                        allOptions={allOptions}
                        onAddParticipant={handleAddToSide}
                        onRemoveParticipant={handleRemoveParticipant}
                        onToggleChampion={handleToggleChampion}
                        disabled={isSubmitting}
                      />
                    ))}

                    {/* Add Side button */}
                    <Card className="flex-1 min-w-48 border-dashed">
                      <CardContent className="flex flex-col items-center justify-center h-full py-6">
                        <Button
                          type="button"
                          variant="ghost"
                          className="flex flex-col gap-2 h-auto py-3"
                          onClick={handleAddSide}
                          disabled={isSubmitting}
                        >
                          <Plus className="h-5 w-5" />
                          <span className="text-sm">Add Side {maxSide + 1}</span>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className={isEditing ? "" : "border-t pt-4"}>
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

// ============================================================================
// SideColumnLocal - Simplified side column for local participant management
// ============================================================================

interface SideColumnLocalProps {
  sideNumber: number
  participants: LocalParticipant[]
  allOptions: ParticipantOption[]
  onAddParticipant: (side: number, participantId: string) => void
  onRemoveParticipant: (id: string) => void
  onToggleChampion: (id: string) => void
  disabled?: boolean
}

function SideColumnLocal({
  sideNumber,
  participants,
  allOptions,
  onAddParticipant,
  onRemoveParticipant,
  onToggleChampion,
  disabled,
}: SideColumnLocalProps) {
  const [selectedId, setSelectedId] = useState("")

  const handleAdd = () => {
    if (!selectedId) return
    onAddParticipant(sideNumber, selectedId)
    setSelectedId("")
  }

  return (
    <Card className="flex-1 min-w-48">
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
              <div
                key={participant.id}
                className="flex items-center gap-1.5 p-2 rounded-md border bg-card text-card-foreground"
              >
                {/* Champion toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onToggleChampion(participant.id)}
                  disabled={disabled}
                  aria-label={participant.isChampion ? "Remove champion" : "Set champion"}
                >
                  <Crown
                    className={
                      participant.isChampion
                        ? "h-3 w-3 text-yellow-500 fill-yellow-500"
                        : "h-3 w-3 text-muted-foreground"
                    }
                  />
                </Button>

                {/* Name and groups */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{participant.participantName}</p>
                  {participant.groups && participant.groups.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {participant.groups.map((g) => (
                        <GroupBadge key={g.id} groupName={g.name} size="sm" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => onRemoveParticipant(participant.id)}
                  disabled={disabled}
                  aria-label="Remove participant"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
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
            searchPlaceholder="Search wrestlers..."
            emptyMessage="None available"
            className="flex-1 min-w-0"
          />
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleAdd}
            disabled={!selectedId || disabled}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
