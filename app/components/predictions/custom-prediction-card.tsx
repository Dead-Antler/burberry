"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { WrestlerMultiSelect } from "./wrestler-multi-select"
import { apiClient } from "@/app/lib/api-client"
import type {
  EventCustomPredictionWithTemplate,
  UserCustomPrediction,
  CustomPredictionStats,
  PredictionType,
  Wrestler,
} from "@/app/lib/api-types"

const PREDICTION_TYPE_LABELS: Record<PredictionType, string> = {
  boolean: "Yes/No",
  count: "Count",
  time: "Time",
  wrestler: "Wrestler",
  text: "Text",
}

interface CustomPredictionCardProps {
  prediction: EventCustomPredictionWithTemplate
  userPrediction?: UserCustomPrediction
  stats?: CustomPredictionStats
  hidePredictors: boolean
  isLocked: boolean
  eventStatus: string
  onPredictionChange: (
    eventCustomPredictionId: string,
    data: Record<string, unknown>
  ) => Promise<void>
}

export function CustomPredictionCard({
  prediction,
  userPrediction,
  stats,
  hidePredictors,
  isLocked,
  eventStatus,
  onPredictionChange,
}: CustomPredictionCardProps) {
  const { eventCustomPrediction: ecp, template } = prediction
  const type = template.predictionType
  const [isSaving, setIsSaving] = useState(false)
  const [wrestlerNames, setWrestlerNames] = useState<Map<string, string>>(new Map())
  const isCompleted = eventStatus === "completed"

  // Fetch wrestler names for display when type is "wrestler"
  useEffect(() => {
    if (type !== "wrestler") return
    apiClient.getAllWrestlers({ isActive: false }).then((data) => {
      const map = new Map<string, string>()
      for (const w of data as Wrestler[]) {
        map.set(w.id, w.currentName)
      }
      setWrestlerNames(map)
    }).catch((err) => console.error('Failed to load wrestler names:', err))
  }, [type])

  // Determine user's prediction value
  const userValue =
    userPrediction?.predictionBoolean ??
    userPrediction?.predictionCount ??
    userPrediction?.predictionWrestlerId ??
    userPrediction?.predictionText ??
    userPrediction?.predictionTime

  // Determine correct answer
  const correctAnswer =
    ecp.answerBoolean ?? ecp.answerCount ?? ecp.answerWrestlerId ?? ecp.answerText ?? ecp.answerTime

  const isCorrect = isCompleted && userPrediction?.isCorrect === true
  const isIncorrect = isCompleted && userPrediction?.isCorrect === false
  const hasPrediction = userValue !== null && userValue !== undefined
  const isMissed = isLocked && !hasPrediction

  const handleChange = async (data: Record<string, unknown>) => {
    if (isLocked) return
    setIsSaving(true)
    try {
      await onPredictionChange(ecp.id, data)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card
      className={cn(
        "py-0 border-l-4",
        isCorrect && "border-l-green-600 dark:border-l-green-500",
        isIncorrect && "border-l-red-600 dark:border-l-red-500",
        hasPrediction && !isCorrect && !isIncorrect && "border-l-primary",
        isMissed && "border-l-muted-foreground/40",
        !hasPrediction && !isMissed && "border-l-transparent",
      )}
    >
      <CardContent className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium">{ecp.question}</p>
          <Badge variant="outline" className="text-xs">
            {PREDICTION_TYPE_LABELS[type]}
          </Badge>
        </div>
        {isCorrect && (
          <Badge variant="default" className="text-xs bg-green-600 shrink-0">
            {userPrediction?.pointsEarned && userPrediction.pointsEarned > 1
              ? `${userPrediction.pointsEarned} pts`
              : "Correct"}
          </Badge>
        )}
        {isIncorrect && (
          <Badge variant="destructive" className="text-xs shrink-0">
            Incorrect
          </Badge>
        )}
      </div>

      {/* Prediction Input */}
      {type === "boolean" && (
        <BooleanInput
          value={userPrediction?.predictionBoolean}
          isLocked={isLocked}
          isSaving={isSaving}
          onChange={(val) => handleChange({ predictionBoolean: val })}
        />
      )}

      {type === "count" && (
        <CountInput
          value={userPrediction?.predictionCount}
          isLocked={isLocked}
          isSaving={isSaving}
          onChange={(val) => handleChange({ predictionCount: val })}
        />
      )}

      {type === "wrestler" && (
        <WrestlerInput
          value={userPrediction?.predictionWrestlerId}
          isLocked={isLocked}
          isSaving={isSaving}
          onChange={(ids) => handleChange({ predictionWrestlerId: JSON.stringify(ids) })}
        />
      )}

      {type === "text" && (
        <TextInput
          value={userPrediction?.predictionText}
          isLocked={isLocked}
          isSaving={isSaving}
          onChange={(val) => handleChange({ predictionText: val })}
        />
      )}

      {type === "time" && (
        <TimeInput
          value={userPrediction?.predictionTime}
          isLocked={isLocked}
          isSaving={isSaving}
          onChange={(val) => handleChange({ predictionTime: val })}
        />
      )}

      {/* Correct Answer (after completion) */}
      {isCompleted && correctAnswer !== null && correctAnswer !== undefined && (
        <div className="text-xs text-muted-foreground pt-1 border-t">
          Correct answer: <span className="font-medium">{formatAnswer(type, correctAnswer, wrestlerNames)}</span>
        </div>
      )}

      {/* Stats */}
      {stats && stats.totalPredictions > 0 && (
        <div className="space-y-1.5 pt-1">
          {stats.distribution.map((d, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">{formatAnswer(type, d.value, wrestlerNames)}</span>
                <span>
                  {d.percentage}% ({d.count})
                </span>
              </div>
              <Progress value={d.percentage} className="h-1" />
              {!hidePredictors && d.predictors && d.predictors.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {d.predictors.map((name, j) => (
                    <Badge key={j} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Input sub-components
// ============================================================================

function BooleanInput({
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

function CountInput({
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

function WrestlerInput({
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

function TextInput({
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

function TimeInput({
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

function formatAnswer(type: PredictionType, value: unknown, wrestlerNames?: Map<string, string>): string {
  if (value === null || value === undefined) return "\u2014"

  switch (type) {
    case "boolean":
      return value === true ? "Yes" : "No"
    case "count":
      return String(value)
    case "time":
      return formatDuration(value as string | Date)
    case "wrestler": {
      // For correct answer display: value is a JSON array string of wrestler IDs
      if (typeof value === "string") {
        try {
          const ids = JSON.parse(value)
          if (Array.isArray(ids)) {
            return ids
              .map((id) => wrestlerNames?.get(id) ?? id)
              .join(", ")
          }
        } catch {
          // Not JSON — single ID or already a name (from stats)
        }
        // Single wrestler ID or already-resolved name
        return wrestlerNames?.get(value) ?? value
      }
      return String(value)
    }
    default:
      return String(value)
  }
}

/** Convert a stored ISO timestamp (offset from epoch) to a duration string like "1:30:00" or "45:00" */
function formatDuration(value: string | Date): string {
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
function parseDuration(input: string): number | null {
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
