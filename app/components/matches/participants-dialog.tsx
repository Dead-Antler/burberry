"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { FuzzyCombobox, type FuzzyComboboxOption } from "@/components/ui/fuzzy-combobox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { getParticipantName } from "@/app/lib/participant-utils"
import type {
  MatchWithParticipants,
  MatchParticipantWithData,
  Wrestler,
  TagTeam,
} from "@/app/lib/api-types"

interface ParticipantsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: MatchWithParticipants | null
  /** Brand ID of the event - used to show warnings for cross-brand participants */
  eventBrandId?: string
  onUpdate: () => void
}

type ParticipantType = "wrestler" | "tag_team"

export function ParticipantsDialog({
  open,
  onOpenChange,
  match,
  eventBrandId,
  onUpdate,
}: ParticipantsDialogProps) {
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([])
  const [tagTeams, setTagTeams] = useState<TagTeam[]>([])
  const [participants, setParticipants] = useState<MatchParticipantWithData[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [participantType, setParticipantType] = useState<ParticipantType>("wrestler")
  const [selectedParticipantId, setSelectedParticipantId] = useState("")
  const [side, setSide] = useState<string>("")

  // Fetch current participants for this match
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

  // Fetch wrestlers, tag teams, and current participants when dialog opens
  useEffect(() => {
    if (open && match) {
      const fetchOptions = async () => {
        setIsLoadingOptions(true)
        try {
          const [wrestlersData, tagTeamsData] = await Promise.all([
            apiClient.getWrestlers({ isActive: true }),
            apiClient.getTagTeams({ isActive: true }),
          ])
          setWrestlers(wrestlersData)
          setTagTeams(tagTeamsData as TagTeam[])
        } catch (err) {
          console.error("Failed to load participants:", err)
        } finally {
          setIsLoadingOptions(false)
        }
      }
      fetchOptions()
      // Initialize participants from match prop, then fetch fresh data
      setParticipants(match.participants || [])
      fetchParticipants()
      // Reset form
      setParticipantType("wrestler")
      setSelectedParticipantId("")
      setSide("")
      setError(null)
    }
  }, [open, match, fetchParticipants])

  const handleAdd = async () => {
    if (!match || !selectedParticipantId) return

    setIsAdding(true)
    setError(null)

    try {
      await apiClient.addMatchParticipant(match.id, {
        participantType,
        participantId: selectedParticipantId,
        side: side ? parseInt(side, 10) : null,
      })
      // Reset form
      setSelectedParticipantId("")
      setSide("")
      // Refetch participants to update the list
      await fetchParticipants()
      onUpdate()
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to add participant"
      setError(message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (participantId: string) => {
    if (!match) return

    setRemovingId(participantId)
    setError(null)

    try {
      await apiClient.removeMatchParticipant(match.id, participantId)
      // Refetch participants to update the list
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

  // Memoize available options filtering and conversion to FuzzyCombobox format
  const { availableOptions, comboboxOptions } = useMemo(() => {
    const participantOptions = participantType === "wrestler" ? wrestlers : tagTeams

    // Filter out already added participants
    const existingParticipantIds = new Set(
      participants
        .filter((p) => p.participantType === participantType)
        .map((p) => p.participantId)
    )
    const available = participantOptions.filter(
      (p) => !existingParticipantIds.has(p.id)
    )

    // Convert to FuzzyCombobox format with cross-brand warnings
    const combobox: FuzzyComboboxOption[] = available.map((option) => {
      const isCrossBrand = Boolean(eventBrandId && option.brandId !== eventBrandId)
      return {
        value: option.id,
        label: "currentName" in option ? option.currentName : option.name,
        warning: isCrossBrand,
        warningTooltip: isCrossBrand ? "Different brand" : undefined,
      }
    })

    return { availableOptions: available, comboboxOptions: combobox }
  }, [participantType, wrestlers, tagTeams, participants, eventBrandId])

  // Sort participants by side for display
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.side === null && b.side === null) return 0
    if (a.side === null) return 1
    if (b.side === null) return -1
    return a.side - b.side
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage Participants</DialogTitle>
          <DialogDescription>
            {match?.matchType} — Match #{match?.matchOrder}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Participants */}
          <div className="space-y-2">
            <Label>Current Participants</Label>
            {sortedParticipants.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No participants added yet.
              </p>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead className="w-[70px]">
                        <span className="sr-only">Remove</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedParticipants.map((participant) => (
                      <TableRow key={participant.id}>
                        <TableCell className="font-medium">
                          {getParticipantName(participant)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {participant.participantType.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {participant.side !== null ? (
                            <Badge variant="secondary">Side {participant.side}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(participant.id)}
                            disabled={removingId === participant.id}
                            aria-label={removingId === participant.id ? "Removing..." : `Remove ${getParticipantName(participant)}`}
                          >
                            {removingId === participant.id ? (
                              <Loader2 className="h-4 w-4 text-destructive animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Add Participant Form */}
          <div className="space-y-4 border-t pt-4">
            <Label>Add Participant</Label>
            {isLoadingOptions ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto]">
                <div className="space-y-2">
                  <Label htmlFor="participant-type" className="text-xs">
                    Type
                  </Label>
                  <Select
                    value={participantType}
                    onValueChange={(v) => {
                      setParticipantType(v as ParticipantType)
                      setSelectedParticipantId("")
                    }}
                  >
                    <SelectTrigger id="participant-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wrestler">Wrestler</SelectItem>
                      <SelectItem value="tag_team">Tag Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="participant-select" className="text-xs">
                    {participantType === "wrestler" ? "Wrestler" : "Tag Team"}
                  </Label>
                  <FuzzyCombobox
                    options={comboboxOptions}
                    value={selectedParticipantId}
                    onValueChange={setSelectedParticipantId}
                    placeholder="Select..."
                    searchPlaceholder={`Search ${participantType === "wrestler" ? "wrestlers" : "tag teams"}...`}
                    emptyMessage={`No ${participantType === "wrestler" ? "wrestlers" : "tag teams"} found.`}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="side" className="text-xs">
                    Side
                  </Label>
                  <Input
                    id="side"
                    type="number"
                    min={1}
                    placeholder="—"
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                    className="w-20"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={handleAdd}
                    disabled={!selectedParticipantId || isAdding}
                    size="icon"
                    aria-label={isAdding ? "Adding..." : "Add participant"}
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {availableOptions.length === 0 && !isLoadingOptions && (
              <p className="text-sm text-muted-foreground">
                No available {participantType === "wrestler" ? "wrestlers" : "tag teams"} to add.
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
