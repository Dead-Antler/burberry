"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { CustomPredictionTemplate, PredictionType } from "@/app/lib/api-types"

const PREDICTION_TYPE_LABELS: Record<PredictionType, string> = {
  boolean: "Yes/No",
  count: "Count",
  time: "Time",
  wrestler: "Wrestler",
  text: "Text",
}

interface AddTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  existingTemplateIds: string[]
  onSuccess: () => void
}

export function AddTemplateDialog({ open, onOpenChange, groupId, existingTemplateIds, onSuccess }: AddTemplateDialogProps) {
  const [templates, setTemplates] = useState<CustomPredictionTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedTemplateId("")
      setError(null)
      setIsLoading(true)
      apiClient.getCustomPredictionTemplates()
        .then(setTemplates)
        .catch(() => setError("Failed to load templates"))
        .finally(() => setIsLoading(false))
    }
  }, [open])

  const availableTemplates = templates.filter((t) => !existingTemplateIds.includes(t.id))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplateId) {
      setError("Please select a template")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await apiClient.addPredictionGroupMember(groupId, selectedTemplateId)
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to add template")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Template to Group</DialogTitle>
            <DialogDescription>Select a prediction template to add to this group.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : availableTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {templates.length === 0
                  ? "No templates available. Create templates first."
                  : "All templates are already in this group."}
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        <span className="text-muted-foreground ml-2">
                          ({PREDICTION_TYPE_LABELS[t.predictionType]})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedTemplateId}>
              {isSubmitting ? "Adding..." : "Add Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
