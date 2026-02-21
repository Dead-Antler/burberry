/**
 * Calculate the display placement for a leaderboard entry, handling ties.
 * When entries are tied (same score), they get the same placement number.
 */
export function getPlacement<T>(
  entries: T[],
  index: number,
  getScore: (entry: T) => number,
): number {
  if (index === 0) return 1
  const current = getScore(entries[index])
  const prev = getScore(entries[index - 1])
  if (current === prev) {
    // Find the first entry with this score
    return entries.findIndex((e) => getScore(e) === current) + 1
  }
  return index + 1
}

/** Return placement-specific styling for leaderboard rows. */
export function getPlacementStyle(placement: number): {
  bgClass: string
  borderClass: string
  textClass: string
} {
  if (placement === 1) {
    return {
      bgClass: "bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20",
      borderClass: "border-yellow-400 dark:border-yellow-600",
      textClass: "text-yellow-600 dark:text-yellow-400",
    }
  }
  if (placement === 2) {
    return {
      bgClass: "bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/20 dark:to-slate-700/20",
      borderClass: "border-slate-400 dark:border-slate-500",
      textClass: "text-slate-600 dark:text-slate-400",
    }
  }
  if (placement === 3) {
    return {
      bgClass: "bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30",
      borderClass: "border-orange-400 dark:border-orange-600",
      textClass: "text-orange-600 dark:text-orange-400",
    }
  }
  return {
    bgClass: "",
    borderClass: "border",
    textClass: "text-muted-foreground",
  }
}

/** Medal emoji for top 3 placements. */
export function getMedal(placement: number): string {
  if (placement === 1) return "🥇"
  if (placement === 2) return "🥈"
  if (placement === 3) return "🥉"
  return ""
}
