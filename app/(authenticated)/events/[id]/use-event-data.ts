import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type {
  Event,
  EventJoin,
  EventJoinWithUser,
  MatchWithParticipants,
  MatchPrediction,
  EventPredictionStats,
  Leaderboard,
  UpdateMatchRequest,
} from "@/app/lib/api-types"

interface UseEventDataReturn {
  event: Event | null
  setEvent: (event: Event | null) => void
  matches: MatchWithParticipants[]
  participants: EventJoinWithUser[]
  userJoin: EventJoin | null
  userPredictions: Map<string, MatchPrediction>
  predictionStats: EventPredictionStats | null
  leaderboard: Leaderboard | null
  setLeaderboard: (leaderboard: Leaderboard | null) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  isLoading: boolean
  error: string | null
  isAnimating: boolean
  setIsAnimating: (animating: boolean) => void
  fetchData: () => Promise<void>
  handlePredictionChange: (matchId: string, data: { predictedSide?: number; predictedParticipantId?: string }) => Promise<void>
  handleMatchUpdate: (matchId: string, data: UpdateMatchRequest) => Promise<void>
  handleCreateSurpriseMatch: () => Promise<void>
}

export function useEventData(eventId: string): UseEventDataReturn {
  const router = useRouter()

  const [event, setEvent] = useState<Event | null>(null)
  const [matches, setMatches] = useState<MatchWithParticipants[]>([])
  const [participants, setParticipants] = useState<EventJoinWithUser[]>([])
  const [userJoin, setUserJoin] = useState<EventJoin | null>(null)
  const [userPredictions, setUserPredictions] = useState<Map<string, MatchPrediction>>(new Map())
  const [predictionStats, setPredictionStats] = useState<EventPredictionStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [activeTab, setActiveTab] = useState<string>("matches")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const eventData = await apiClient.getEvent(eventId, {
        includeMatches: true,
      })

      setEvent(eventData)
      setMatches(eventData.matches || [])

      try {
        const joinStatus = await apiClient.getEventJoinStatus(eventId)
        setUserJoin(joinStatus)
      } catch {
        if (eventData.status !== 'completed') {
          router.push('/events')
          return
        }
      }

      const participantsData = await apiClient.getEventParticipants(eventId)
      setParticipants(participantsData)

      const predictionsData = await apiClient.getMatchPredictions({ eventId })
      const predMap = new Map<string, MatchPrediction>()
      predictionsData.forEach((pred) => {
        predMap.set(pred.matchId, pred)
      })
      setUserPredictions(predMap)

      try {
        const stats = await apiClient.getEventPredictionStats(eventId)
        setPredictionStats(stats)
      } catch (err) {
        console.error('Failed to load prediction stats:', err)
      }

      if (eventData.status === 'completed') {
        try {
          const scores = await apiClient.getLeaderboard(eventId)
          setLeaderboard(scores)
          setActiveTab('results')
        } catch (err) {
          console.error('Failed to load leaderboard:', err)
        }
      }
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load event data"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [eventId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // SSE for real-time push updates
  useEffect(() => {
    let eventSource: EventSource | null = null

    const connectSSE = () => {
      eventSource = new EventSource(`/api/events/${eventId}/live`)

      eventSource.addEventListener('update', async (e) => {
        const data = JSON.parse(e.data)

        switch (data.type) {
          case 'event-updated':
            setEvent(data.event)
            if (data.event.status === 'completed') {
              setActiveTab('results')
              try {
                const scores = await apiClient.getLeaderboard(eventId)
                setLeaderboard(scores)
                setTimeout(() => {
                  setIsAnimating(true)
                }, 300)
              } catch (err) {
                console.error('Failed to fetch leaderboard:', err)
              }
            }
            break

          case 'matches-changed': {
            const eventData = await apiClient.getEvent(eventId, { includeMatches: true })
            setMatches(eventData.matches || [])
            break
          }

          case 'participants-changed': {
            const participantsData = await apiClient.getEventParticipants(eventId)
            setParticipants(participantsData)
            break
          }

          case 'predictions-changed': {
            const stats = await apiClient.getEventPredictionStats(eventId)
            setPredictionStats(stats)
            break
          }
        }
      })

      eventSource.addEventListener('ping', () => {
        // Keep-alive ping, no action needed
      })

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error)
        eventSource?.close()
        setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [eventId])

  const handlePredictionChange = async (
    matchId: string,
    data: { predictedSide?: number; predictedParticipantId?: string }
  ) => {
    try {
      const tempPrediction: MatchPrediction = {
        id: 'temp',
        userId: 'temp',
        matchId,
        predictedSide: data.predictedSide ?? null,
        predictedParticipantId: data.predictedParticipantId ?? null,
        isCorrect: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      setUserPredictions((prev) => new Map(prev).set(matchId, tempPrediction))

      const savedPrediction = await apiClient.createMatchPrediction({
        matchId,
        ...data,
      })

      setUserPredictions((prev) => new Map(prev).set(matchId, savedPrediction))

      const stats = await apiClient.getEventPredictionStats(eventId)
      setPredictionStats(stats)
    } catch (err) {
      console.error('Failed to save prediction:', err)
      fetchData()
    }
  }

  const handleMatchUpdate = async (matchId: string, data: UpdateMatchRequest) => {
    try {
      await apiClient.updateMatch(matchId, data)
      const eventData = await apiClient.getEvent(eventId, { includeMatches: true })
      setMatches(eventData.matches || [])
      if (data.winningSide !== undefined || data.winnerParticipantId !== undefined) {
        const stats = await apiClient.getEventPredictionStats(eventId)
        setPredictionStats(stats)
      }
    } catch (err) {
      console.error('Failed to update match:', err)
      alert(`Failed to update match: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleCreateSurpriseMatch = async () => {
    try {
      const nextMatchOrder = Math.max(...matches.map(m => m.matchOrder), 0) + 1
      await apiClient.createMatch({
        eventId,
        matchOrder: nextMatchOrder,
        matchType: 'Surprise',
        unknownParticipants: true,
        isLocked: false,
      })
      const eventData = await apiClient.getEvent(eventId, { includeMatches: true })
      setMatches(eventData.matches || [])
    } catch (err) {
      console.error('Failed to create surprise match:', err)
      alert(`Failed to create surprise match: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return {
    event,
    setEvent,
    matches,
    participants,
    userJoin,
    userPredictions,
    predictionStats,
    leaderboard,
    setLeaderboard,
    activeTab,
    setActiveTab,
    isLoading,
    error,
    isAnimating,
    setIsAnimating,
    fetchData,
    handlePredictionChange,
    handleMatchUpdate,
    handleCreateSurpriseMatch,
  }
}
