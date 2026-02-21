"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { CustomPredictionTemplate, PredictionType, ScoringMode } from "@/app/lib/api-types"

const PREDICTION_TYPES: { value: PredictionType; label: string }[] = [
  { value: "boolean", label: "Yes/No" },
  { value: "count", label: "Count" },
  { value: "time", label: "Time" },
  { value: "wrestler", label: "Wrestler" },
  { value: "text", label: "Text" },
]

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: CustomPredictionTemplate | null
  onSuccess: (template: CustomPredictionTemplate) => void
}

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [predictionType, setPredictionType] = useState<PredictionType>("boolean")
  const [scoringMode, setScoringMode] = useState<ScoringMode>("exact")
  const [cooldownDays, setCooldownDays] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = template !== null && template !== undefined

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "")
      setDescription(template?.description ?? "")
      setPredictionType(template?.predictionType ?? "boolean")
      setScoringMode(template?.scoringMode ?? "exact")
      setCooldownDays(template?.cooldownDays?.toString() ?? "")
      setError(null)
    }
  }, [open, template])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Template name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: CustomPredictionTemplate
      const parsedCooldown = cooldownDays ? parseInt(cooldownDays) : null
      const data = {
        name: trimmedName,
        description: description.trim() || null,
        predictionType,
        scoringMode: (predictionType === "count" || predictionType === "time") ? scoringMode : "exact" as ScoringMode,
        cooldownDays: predictionType === "wrestler" && parsedCooldown && !isNaN(parsedCooldown) ? parsedCooldown : null,
      }

      if (isEditing) {
        result = await apiClient.updateCustomPredictionTemplate(template.id, data)
      } else {
        result = await apiClient.createCustomPredictionTemplate(data)
      }
      onSuccess(result)
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : isEditing
            ? "Failed to update template"
            : "Failed to create template"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Template" : "Create Template"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the prediction template details."
                : "Define a new custom prediction template."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., First Blood"
                maxLength={100}
                autoFocus
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">Default Question</Label>
              <Input
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Who will bleed first?"
                maxLength={500}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-type">Answer Type</Label>
              <Select
                value={predictionType}
                onValueChange={(v) => {
                  setPredictionType(v as PredictionType)
                  // Reset type-specific fields when switching
                  setScoringMode("exact")
                  setCooldownDays("")
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PREDICTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(predictionType === "count" || predictionType === "time") && (
              <div className="space-y-2">
                <Label htmlFor="template-scoring">Scoring Mode</Label>
                <Select
                  value={scoringMode}
                  onValueChange={(v) => setScoringMode(v as ScoringMode)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="template-scoring">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact Match</SelectItem>
                    <SelectItem value="closest_under">Closest Without Going Over</SelectItem>
                  </SelectContent>
                </Select>
                {scoringMode === "closest_under" && (
                  <p className="text-xs text-muted-foreground">
                    Only the closest prediction(s) that don&apos;t exceed the answer earn a point. If everyone goes over, nobody scores.
                  </p>
                )}
              </div>
            )}
            {predictionType === "wrestler" && (
              <div className="space-y-2">
                <Label htmlFor="template-cooldown">Cooldown (days)</Label>
                <Input
                  id="template-cooldown"
                  type="number"
                  min={1}
                  max={365}
                  value={cooldownDays}
                  onChange={(e) => setCooldownDays(e.target.value)}
                  placeholder="e.g., 90"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Per brand — prevents reusing the same wrestler within this period. Leave empty for no cooldown.
                </p>
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
