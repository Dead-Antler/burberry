"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
  type PredictionGroup,
  type PredictionGroupWithMembers,
} from "@/app/lib/api-types"

interface ApplyGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  existingTemplateIds: string[]
  onSuccess: () => void
}

export function ApplyGroupDialog({
  open,
  onOpenChange,
  eventId,
  existingTemplateIds,
  onSuccess,
}: ApplyGroupDialogProps) {
  const [groups, setGroups] = useState<PredictionGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [groupDetails, setGroupDetails] = useState<PredictionGroupWithMembers | null>(null)
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedGroupId("")
      setGroupDetails(null)
      setError(null)
      setIsLoadingGroups(true)
      apiClient.getPredictionGroups()
        .then(setGroups)
        .catch(() => setError("Failed to load groups"))
        .finally(() => setIsLoadingGroups(false))
    }
  }, [open])

  const handleGroupChange = async (groupId: string) => {
    setSelectedGroupId(groupId)
    setGroupDetails(null)
    setError(null)
    setIsLoadingDetails(true)
    try {
      const details = await apiClient.getPredictionGroup(groupId)
      setGroupDetails(details)
    } catch {
      setError("Failed to load group details")
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Filter out templates already added to the event
  const newTemplates = groupDetails?.templates.filter(
    (t) => !existingTemplateIds.includes(t.id)
  ) ?? []
  const skippedCount = (groupDetails?.templates.length ?? 0) - newTemplates.length

  const handleApply = async () => {
    if (newTemplates.length === 0) return

    setIsApplying(true)
    setError(null)

    try {
      for (const template of newTemplates) {
        await apiClient.createEventCustomPrediction(eventId, {
          templateId: template.id,
          question: template.description ?? template.name,
        })
      }
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to apply group"
      )
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Apply Prediction Group</DialogTitle>
          <DialogDescription>
            Add all templates from a group to this event.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {isLoadingGroups ? (
            <Skeleton className="h-10 w-full" />
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No groups available. Create groups in Settings first.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Group</Label>
              <Select
                value={selectedGroupId}
                onValueChange={handleGroupChange}
                disabled={isApplying}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a group..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview of templates to be added */}
          {isLoadingDetails && <Skeleton className="h-20 w-full" />}
          {groupDetails && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Templates to add ({newTemplates.length})
              </Label>
              {newTemplates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  All templates in this group are already added to this event.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {newTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm">
                      <span>{t.description ?? t.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {PREDICTION_TYPE_LABELS[t.predictionType]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {skippedCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {skippedCount} template{skippedCount > 1 ? "s" : ""} already added, will be skipped.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={isApplying || newTemplates.length === 0}
          >
            {isApplying
              ? "Applying..."
              : `Apply ${newTemplates.length} Template${newTemplates.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
