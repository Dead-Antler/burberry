"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WrestlerMultiSelect } from "./wrestler-multi-select"

// ============================================================================
// Boolean Input
// ============================================================================

export function BooleanInput({
  value,
  isLocked,
  isSaving,
  onChange,
}: {
  value?: boolean | null
  isLocked: boolean
  isSaving: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={value === true ? "default" : "outline"}
        onClick={() => onChange(true)}
        disabled={isLocked || isSaving}
      >
        Yes
      </Button>
      <Button
        size="sm"
        variant={value === false ? "default" : "outline"}
        onClick={() => onChange(false)}
        disabled={isLocked || isSaving}
      >
        No
      </Button>
    </div>
  )
}

// ============================================================================
// Count Input
// ============================================================================

export function CountInput({
  value,
  isLocked,
  isSaving,
  onChange,
}: {
  value?: number | null
  isLocked: boolean
  isSaving: boolean
  onChange: (val: number) => void
}) {
  const [localValue, setLocalValue] = useState(value?.toString() ?? "")

  const handleSubmit = () => {
    const num = parseInt(localValue)
    if (!isNaN(num) && num >= 0) onChange(num)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
          }
        }}
        className="w-24"
        placeholder="0"
        disabled={isLocked || isSaving}
        aria-label="Prediction count"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={isLocked || isSaving || !localValue}
      >
        {value !== null && value !== undefined ? "Update" : "Submit"}
      </Button>
      {value !== null && value !== undefined && (
        <span className="text-xs text-muted-foreground">
          Your prediction: <strong>{value}</strong>
        </span>
      )}
    </div>
  )
}

// ============================================================================
// Wrestler Input
// ============================================================================

export function WrestlerInput({
  value,
  isLocked,
  isSaving,
  onChange,
}: {
  value?: string | null
  isLocked: boolean
  isSaving: boolean
  onChange: (ids: string[]) => void
}) {
  // Parse JSON array from stored string
  let wrestlerIds: string[] = []
  if (value) {
    try {
      const parsed = JSON.parse(value)
      wrestlerIds = Array.isArray(parsed) ? parsed : [value]
    } catch {
      wrestlerIds = [value] // legacy single-ID fallback
    }
  }

  return (
    <WrestlerMultiSelect
      value={wrestlerIds}
      onValueChange={onChange}
      disabled={isLocked || isSaving}
      placeholder="Select wrestlers..."
    />
  )
}

// ============================================================================
// Text Input
// ============================================================================

export function TextInput({
  value,
  isLocked,
  isSaving,
  onChange,
}: {
  value?: string | null
  isLocked: boolean
  isSaving: boolean
  onChange: (val: string) => void
}) {
  const [localValue, setLocalValue] = useState(value ?? "")

  const handleSubmit = () => {
    const trimmed = localValue.trim()
    if (trimmed) onChange(trimmed)
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            handleSubmit()
          }
        }}
        className="flex-1"
        placeholder="Enter your prediction..."
        maxLength={200}
        disabled={isLocked || isSaving}
        aria-label="Your prediction"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleSubmit}
        disabled={isLocked || isSaving || !localValue.trim()}
      >
        {value ? "Update" : "Submit"}
      </Button>
    </div>
  )
}

// ============================================================================
// Time Input
// ============================================================================

export function TimeInput({
  value,
  isLocked,
  isSaving,
  onChange,
}: {
  value?: Date | string | null
  isLocked: boolean
  isSaving: boolean
  onChange: (val: string) => void
}) {
  const defaultTime = value ? formatDuration(value) : ""
  const [localValue, setLocalValue] = useState(defaultTime)

  const handleSubmit = () => {
    const seconds = parseDuration(localValue)
    if (seconds !== null) {
      const date = new Date(seconds * 1000)
      onChange(date.toISOString())
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder="e.g., 1:30:00 or 45:00"
          className="w-36"
          disabled={isLocked || isSaving}
          aria-label="Match duration"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSubmit}
          disabled={isLocked || isSaving || !localValue}
        >
          {value ? "Update" : "Submit"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Format: H:MM:SS, MM:SS, or seconds. Enter 0 for &ldquo;not at all&rdquo;.
      </p>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

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
    return parts[0] // treat as seconds
  }
  return null
}
