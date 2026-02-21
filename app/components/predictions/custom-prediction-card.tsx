"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { apiClient } from "@/app/lib/api-client"
import {
  BooleanInput,
  CountInput,
  WrestlerInput,
  TextInput,
  TimeInput,
  formatDuration,
} from "./custom-prediction-inputs"
import type {
  EventCustomPredictionWithTemplate,
  UserCustomPrediction,
  CustomPredictionStats,
  PredictionType,
  UpdateUserCustomPredictionRequest,
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
    data: UpdateUserCustomPredictionRequest
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

  const handleChange = async (data: UpdateUserCustomPredictionRequest) => {
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
