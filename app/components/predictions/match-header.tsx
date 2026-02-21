"use client"

import { useState, useEffect } from "react"
import { Clock, Lock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { MatchWithParticipants } from "@/app/lib/api-types"

interface MatchHeaderProps {
  match: MatchWithParticipants
  isLocked: boolean
}

export function MatchHeader({ match, isLocked }: MatchHeaderProps) {
  const [countdown, setCountdown] = useState<string>("")

  useEffect(() => {
    if (!match.predictionDeadline || isLocked) return

    const updateCountdown = () => {
      const now = new Date().getTime()
      const end = new Date(match.predictionDeadline!).getTime()
      const diff = end - now

      if (diff <= 0) {
        setCountdown("Time's up!")
        return
      }

      const minutes = Math.floor(diff / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [match.predictionDeadline, isLocked])

  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-base font-medium">
        Match {match.matchOrder}
      </span>
      {match.matchType && (
        <Badge variant="outline" className="text-sm">
          {match.matchType}
        </Badge>
      )}
      {match.isLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
      {match.predictionDeadline && !isLocked && countdown && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <Clock className="h-3 w-3" />
          {countdown}
        </div>
      )}
    </div>
  )
}
