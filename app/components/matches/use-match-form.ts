import { useCallback, useEffect, useMemo, useState } from "react"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { FuzzyComboboxOption } from "@/components/ui/fuzzy-combobox"
import type { Match, MatchWithParticipants, WrestlerWithGroups, Brand } from "@/app/lib/api-types"

type ParticipantType = "wrestler" | "group"

export interface LocalParticipant {
  id: string
  participantType: ParticipantType
  participantId: string
  participantName: string
  side: number | null
  isChampion: boolean
  groups?: Array<{ id: string; name: string }>
}

export interface MatchParticipantOption extends FuzzyComboboxOption {
  type: ParticipantType
}

export const COMMON_MATCH_TYPES = [
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

interface UseMatchFormProps {
  open: boolean
  eventId: string
  eventBrandId?: string
  match?: MatchWithParticipants | null
  nextOrder?: number
  onSuccess: (match: Match) => void
}

export function useMatchForm({
  open,
  eventId,
  eventBrandId,
  match,
  nextOrder = 1,
  onSuccess,
}: UseMatchFormProps) {
  const [matchType, setMatchType] = useState("")
  const [unknownParticipants, setUnknownParticipants] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wrestlers, setWrestlers] = useState<WrestlerWithGroups[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [localParticipants, setLocalParticipants] = useState<LocalParticipant[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [explicitSides, setExplicitSides] = useState<number[]>([])

  const isEditing = match !== null && match !== undefined

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

  const brandMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const brand of brands) {
      map.set(brand.id, brand.name)
    }
    return map
  }, [brands])

  const { participantsBySide, sideNumbers, maxSide } = useMemo(() => {
    const bySide = new Map<number, LocalParticipant[]>()

    for (const p of localParticipants) {
      const side = p.side ?? 0
      if (!bySide.has(side)) {
        bySide.set(side, [])
      }
      bySide.get(side)!.push(p)
    }

    const fromParticipants = new Set(
      localParticipants.map((p) => p.side).filter((s): s is number => s !== null)
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
  }, [localParticipants, explicitSides])

  const allOptions = useMemo(() => {
    const existingIds = new Set(localParticipants.map((p) => p.participantId))

    const wrestlerOpts: MatchParticipantOption[] = wrestlers
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
        result = await apiClient.updateMatch(match.id, {
          matchType: trimmedType,
          unknownParticipants,
        })
      } else {
        const participants = localParticipants.map((p) => ({
          side: p.side,
          participantType: p.participantType,
          participantId: p.participantId,
          isChampion: p.isChampion,
        }))

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

  return {
    matchType,
    setMatchType,
    unknownParticipants,
    setUnknownParticipants,
    isSubmitting,
    error,
    isEditing,
    localParticipants,
    isLoadingOptions,
    participantsBySide,
    sideNumbers,
    maxSide,
    allOptions,
    handleAddToSide,
    handleRemoveParticipant,
    handleToggleChampion,
    handleAddSide,
    handleSubmit,
  }
}
