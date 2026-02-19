import { useCallback, useEffect, useState } from "react"
import type { Leaderboard } from "@/app/lib/api-types"

interface UseLeaderboardAnimationReturn {
  isAnimating: boolean
  visibleCount: number
  hasAnimated: boolean
  startAnimation: () => void
}

export function useLeaderboardAnimation(
  leaderboard: Leaderboard | null,
  externalIsAnimating: boolean,
  setExternalIsAnimating: (v: boolean) => void,
): UseLeaderboardAnimationReturn {
  const [visibleCount, setVisibleCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)

  const triggerConfetti = useCallback(async () => {
    const { default: confetti } = await import("canvas-confetti")
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      })
    }, 250)
  }, [])

  useEffect(() => {
    if (!externalIsAnimating || !leaderboard) return

    const totalEntries = leaderboard.length
    let currentIndex = totalEntries - 1

    setVisibleCount(0)

    const interval = setInterval(() => {
      if (currentIndex < 0) {
        clearInterval(interval)
        setExternalIsAnimating(false)
        setHasAnimated(true)
        setTimeout(() => {
          triggerConfetti()
        }, 300)
        return
      }

      setVisibleCount((prev) => prev + 1)
      currentIndex--
    }, 500)

    return () => clearInterval(interval)
  }, [externalIsAnimating, leaderboard, setExternalIsAnimating, triggerConfetti])

  const startAnimation = useCallback(() => {
    setExternalIsAnimating(true)
  }, [setExternalIsAnimating])

  return {
    isAnimating: externalIsAnimating,
    visibleCount,
    hasAnimated,
    startAnimation,
  }
}
