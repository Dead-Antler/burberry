/** Convert a stored ISO timestamp (offset from epoch) to a duration string like "1:30:00" or "45:00" */
export function formatDuration(value: string | Date): string {
  try {
    const ms = new Date(value).getTime()
    const totalSeconds = Math.round(ms / 1000)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = totalSeconds % 60
    const pad = (n: number) => n.toString().padStart(2, "0")
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
  } catch {
    return String(value)
  }
}

/** Parse a duration string like "1:30:00", "45:00", or "90" into total seconds. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const parts = trimmed.split(":").map(Number)
  if (parts.some(isNaN)) return null

  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  } else if (parts.length === 2) {
    const [m, s] = parts
    return m * 60 + s
  } else if (parts.length === 1) {
    return parts[0]
  }
  return null
}
