import { useCallback, useEffect, useMemo, useState } from "react"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { groupParticipantsBySide } from "@/app/lib/participant-utils"
import type { FuzzyComboboxOption } from "@/components/ui/fuzzy-combobox"
import type {
  MatchWithParticipants,
  MatchParticipantWithData,
  WrestlerWithGroups,
  Brand,
} from "@/app/lib/api-types"

export type ParticipantType = "wrestler" | "group"

export interface ParticipantOption extends FuzzyComboboxOption {
  type: ParticipantType
}

interface UseParticipantManagementProps {
  match: MatchWithParticipants | null
  open: boolean
  eventBrandId?: string
  onUpdate: () => void
}

export function useParticipantManagement({
  match,
  open,
  eventBrandId,
  onUpdate,
}: UseParticipantManagementProps) {
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

  const { participantsBySide, sideNumbers, maxSide } = useMemo(() => {
    const bySide = groupParticipantsBySide(participants)

    const fromParticipants = new Set(
      participants.map((p) => p.side).filter((s): s is number => s !== null)
    )

    const merged = new Set([...fromParticipants, ...explicitSides])

    if (merged.size === 0) {
      merged.add(1)
      merged.add(2)
    } else if (merged.size === 1) {
      merged.add(merged.has(1) ? 2 : 1)
    }

    const sides = Array.from(merged).sort((a, b) => a - b)
    const max = Math.max(...sides, 0)

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

  const brandMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const brand of brands) {
      map.set(brand.id, brand.name)
    }
    return map
  }, [brands])

  const wrestlerGroupsMap = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string }>>()
    for (const wrestler of wrestlers) {
      map.set(wrestler.id, wrestler.groups)
    }
    return map
  }, [wrestlers])

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
        searchTerms: w.groups.map((g) => g.name),
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

  return {
    participants,
    participantsBySide,
    sideNumbers,
    maxSide,
    allOptions,
    isLoadingOptions,
    removingId,
    togglingChampionId,
    movingId,
    error,
    wrestlerGroupsMap,
    handleAddToSide,
    handleRemove,
    handleToggleChampion,
    handleMoveParticipant,
    handleAddSide,
  }
}
