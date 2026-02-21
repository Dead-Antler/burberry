"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { WrestlerMultiSelect } from "../predictions/wrestler-multi-select"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { EventCustomPredictionWithTemplate, UpdateEventCustomPredictionRequest } from "@/app/lib/api-types"
import { formatDuration, parseDuration } from "@/app/lib/time-utils"

// ============================================================================
// Answer Setting Row
// ============================================================================

interface AnswerSettingProps {
  prediction: EventCustomPredictionWithTemplate
  eventId: string
  onUpdated: () => void
}

export function AnswerSetting({ prediction, eventId, onUpdated }: AnswerSettingProps) {
  const { eventCustomPrediction: ecp, template } = prediction
  const type = template.predictionType
  const [isSaving, setIsSaving] = useState(false)

  const handleSetAnswer = async (data: UpdateEventCustomPredictionRequest) => {
    setIsSaving(true)
    try {
      await apiClient.updateEventCustomPrediction(eventId, ecp.id, {
        ...data,
        isScored: true,
      })
      onUpdated()
    } catch (err) {
      console.error("Failed to set answer:", err)
      alert(err instanceof ApiClientError ? err.message : "Failed to set answer")
    } finally {
      setIsSaving(false)
    }
  }

  const currentAnswer = ecp.answerBoolean ?? ecp.answerCount ?? ecp.answerWrestlerId ?? ecp.answerText ?? ecp.answerTime
  const hasAnswer = currentAnswer !== null && currentAnswer !== undefined

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Set Answer</Label>

      {type === "boolean" && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant={ecp.answerBoolean === true ? "default" : "outline"}
            onClick={() => handleSetAnswer({ answerBoolean: true })}
            disabled={isSaving}
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant={ecp.answerBoolean === false ? "default" : "outline"}
            onClick={() => handleSetAnswer({ answerBoolean: false })}
            disabled={isSaving}
          >
            No
          </Button>
          {hasAnswer && (
            <Badge variant="default" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Answer Set
            </Badge>
          )}
        </div>
      )}

      {type === "count" && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            defaultValue={ecp.answerCount ?? ""}
            className="w-24"
            disabled={isSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const val = parseInt((e.target as HTMLInputElement).value)
                if (!isNaN(val)) handleSetAnswer({ answerCount: val })
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={(e) => {
              const input = (e.target as HTMLElement).parentElement?.querySelector("input")
              const val = parseInt(input?.value ?? "")
              if (!isNaN(val)) handleSetAnswer({ answerCount: val })
            }}
          >
            Set
          </Button>
          {hasAnswer && (
            <Badge variant="default" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              {ecp.answerCount}
            </Badge>
          )}
        </div>
      )}

      {type === "wrestler" && (
        <WrestlerAnswerInput
          value={ecp.answerWrestlerId}
          isSaving={isSaving}
          hasAnswer={hasAnswer}
          onSetAnswer={handleSetAnswer}
        />
      )}

      {type === "text" && (
        <div className="flex items-center gap-2">
          <Input
            defaultValue={ecp.answerText ?? ""}
            className="flex-1"
            maxLength={200}
            disabled={isSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) handleSetAnswer({ answerText: val })
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={(e) => {
              const input = (e.target as HTMLElement).parentElement?.querySelector("input")
              const val = input?.value?.trim()
              if (val) handleSetAnswer({ answerText: val })
            }}
          >
            Set
          </Button>
          {hasAnswer && (
            <Badge variant="default" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              Set
            </Badge>
          )}
        </div>
      )}

      {type === "time" && (
        <div className="flex items-center gap-2">
          <Input
            defaultValue={ecp.answerTime ? formatDuration(ecp.answerTime) : ""}
            placeholder="e.g., 1:30:00 or 45:00"
            className="w-36"
            disabled={isSaving}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const seconds = parseDuration((e.target as HTMLInputElement).value)
                if (seconds !== null) {
                  handleSetAnswer({ answerTime: new Date(seconds * 1000).toISOString() })
                }
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={(e) => {
              const input = (e.target as HTMLElement).parentElement?.querySelector("input")
              const seconds = parseDuration(input?.value ?? "")
              if (seconds !== null) {
                handleSetAnswer({ answerTime: new Date(seconds * 1000).toISOString() })
              }
            }}
          >
            Set
          </Button>
          {hasAnswer && (
            <Badge variant="default" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              {formatDuration(ecp.answerTime!)}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Wrestler Answer Input (multi-select for admin answer setting)
// ============================================================================

function WrestlerAnswerInput({
  value,
  isSaving,
  hasAnswer,
  onSetAnswer,
}: {
  value: string | null
  isSaving: boolean
  hasAnswer: boolean
  onSetAnswer: (data: UpdateEventCustomPredictionRequest) => Promise<void>
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

  const [localIds, setLocalIds] = useState<string[]>(wrestlerIds)

  return (
    <div className="space-y-2">
      <WrestlerMultiSelect
        value={localIds}
        onValueChange={setLocalIds}
        disabled={isSaving}
        placeholder="Select wrestler answer(s)..."
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isSaving || localIds.length === 0}
          onClick={() => onSetAnswer({ answerWrestlerId: JSON.stringify(localIds) })}
        >
          Set Answer
        </Button>
        {hasAnswer && (
          <Badge variant="default" className="text-xs">
            <Check className="h-3 w-3 mr-1" />
            {wrestlerIds.length} wrestler{wrestlerIds.length !== 1 ? "s" : ""} set
          </Badge>
        )}
      </div>
    </div>
  )
}
