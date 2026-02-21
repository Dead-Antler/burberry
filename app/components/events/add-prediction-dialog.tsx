"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import {
  PREDICTION_TYPE_LABELS,
  type CustomPredictionTemplate,
  type EventCustomPredictionWithTemplate,
} from "@/app/lib/api-types"

interface AddPredictionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  editing?: EventCustomPredictionWithTemplate | null
  onSuccess: () => void
}

export function AddPredictionDialog({
  open,
  onOpenChange,
  eventId,
  editing,
  onSuccess,
}: AddPredictionDialogProps) {
  const [templates, setTemplates] = useState<CustomPredictionTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [question, setQuestion] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = editing !== null && editing !== undefined

  useEffect(() => {
    if (open) {
      setQuestion(editing?.eventCustomPrediction.question ?? "")
      setSelectedTemplateId(editing?.eventCustomPrediction.templateId ?? "")
      setError(null)

      if (!isEditing) {
        setIsLoadingTemplates(true)
        apiClient.getCustomPredictionTemplates()
          .then(setTemplates)
          .catch(() => setError("Failed to load templates"))
          .finally(() => setIsLoadingTemplates(false))
      }
    }
  }, [open, editing, isEditing])

  const handleTemplateChange = (templateId: string) => {
    const prevTemplate = templates.find((t) => t.id === selectedTemplateId)
    const newTemplate = templates.find((t) => t.id === templateId)
    setSelectedTemplateId(templateId)

    // Auto-fill question from template's default question if field is empty or unchanged
    if (newTemplate && (!question || question === prevTemplate?.description)) {
      setQuestion(newTemplate.description ?? "")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEditing && !selectedTemplateId) {
      setError("Please select a template")
      return
    }
    if (!question.trim()) {
      setError("Question is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditing) {
        await apiClient.updateEventCustomPrediction(eventId, editing.eventCustomPrediction.id, {
          question: question.trim(),
        })
      } else {
        await apiClient.createEventCustomPrediction(eventId, {
          templateId: selectedTemplateId,
          question: question.trim(),
        })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to save prediction"
      )
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
              {isEditing ? "Edit Custom Prediction" : "Add Custom Prediction"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the question for this custom prediction."
                : "Select a template and write a question for this event."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!isEditing && (
              <div className="space-y-2">
                <Label>Template</Label>
                {isLoadingTemplates ? (
                  <Skeleton className="h-10 w-full" />
                ) : templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No templates available. Create templates in Settings first.
                  </p>
                ) : (
                  <Select
                    value={selectedTemplateId}
                    onValueChange={handleTemplateChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                          <span className="text-muted-foreground ml-2">
                            ({PREDICTION_TYPE_LABELS[t.predictionType]})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {isEditing && (
              <div className="space-y-1">
                <Label>Template</Label>
                <div className="flex items-center gap-2 text-sm">
                  <span>{editing.template.name}</span>
                  <Badge variant="secondary">
                    {PREDICTION_TYPE_LABELS[editing.template.predictionType]}
                  </Badge>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pred-question">Question</Label>
              <Input
                id="pred-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., Who will get first blood?"
                maxLength={500}
                autoFocus={isEditing}
                disabled={isSubmitting}
              />
            </div>
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
            <Button
              type="submit"
              disabled={isSubmitting || (!isEditing && !selectedTemplateId)}
            >
              {isSubmitting
                ? isEditing ? "Saving..." : "Adding..."
                : isEditing ? "Save Changes" : "Add Prediction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
