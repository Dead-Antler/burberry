"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, MoreHorizontal, Check, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { WrestlerMultiSelect } from "../predictions/wrestler-multi-select"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type {
  CustomPredictionTemplate,
  EventCustomPrediction,
  EventCustomPredictionWithTemplate,
  PredictionType,
  PredictionGroup,
  PredictionGroupWithMembers,
} from "@/app/lib/api-types"

const PREDICTION_TYPE_LABELS: Record<PredictionType, string> = {
  boolean: "Yes/No",
  count: "Count",
  time: "Time",
  wrestler: "Wrestler",
  text: "Text",
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
    return parts[0]
  }
  return null
}

// ============================================================================
// Add/Edit Custom Prediction Dialog
// ============================================================================

interface AddPredictionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  editing?: EventCustomPredictionWithTemplate | null
  onSuccess: () => void
}

function AddPredictionDialog({
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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

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

// ============================================================================
// Answer Setting Row
// ============================================================================

interface AnswerSettingProps {
  prediction: EventCustomPredictionWithTemplate
  eventId: string
  onUpdated: () => void
}

function AnswerSetting({ prediction, eventId, onUpdated }: AnswerSettingProps) {
  const { eventCustomPrediction: ecp, template } = prediction
  const type = template.predictionType
  const [isSaving, setIsSaving] = useState(false)

  const handleSetAnswer = async (data: Record<string, unknown>) => {
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
  onSetAnswer: (data: Record<string, unknown>) => Promise<void>
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

// ============================================================================
// Apply Group Dialog
// ============================================================================

interface ApplyGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  existingTemplateIds: string[]
  onSuccess: () => void
}

function ApplyGroupDialog({
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

// ============================================================================
// Main Component
// ============================================================================

interface CustomPredictionAdminProps {
  eventId: string
  eventStatus: string
  customPredictions: EventCustomPredictionWithTemplate[]
  onUpdated: () => void
}

export function CustomPredictionAdmin({
  eventId,
  eventStatus,
  customPredictions,
  onUpdated,
}: CustomPredictionAdminProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isApplyGroupOpen, setIsApplyGroupOpen] = useState(false)
  const [editing, setEditing] = useState<EventCustomPredictionWithTemplate | null>(null)
  const [deleting, setDeleting] = useState<EventCustomPredictionWithTemplate | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canModify = eventStatus === "pending" || eventStatus === "open"
  const canSetAnswers = eventStatus === "locked"

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await apiClient.deleteEventCustomPrediction(eventId, deleting.eventCustomPrediction.id)
      setDeleting(null)
      onUpdated()
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError ? err.message : "Failed to delete"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="border-t pt-3 mt-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Custom Predictions ({customPredictions.length})
          </span>
          {canModify && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsApplyGroupOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5 mr-1" />
                Add Group
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          )}
        </div>

        {customPredictions.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            No custom predictions added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {customPredictions.map((cp) => (
              <div
                key={cp.eventCustomPrediction.id}
                className="border rounded-md p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {cp.eventCustomPrediction.question}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {cp.template.name}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {PREDICTION_TYPE_LABELS[cp.template.predictionType]}
                      </Badge>
                    </div>
                  </div>
                  {canModify && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(cp)}>
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(cp)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-3.5 w-3.5" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Answer setting (when locked) */}
                {canSetAnswers && (
                  <AnswerSetting
                    prediction={cp}
                    eventId={eventId}
                    onUpdated={onUpdated}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Dialog */}
      <AddPredictionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        eventId={eventId}
        onSuccess={onUpdated}
      />

      {/* Apply Group Dialog */}
      <ApplyGroupDialog
        open={isApplyGroupOpen}
        onOpenChange={setIsApplyGroupOpen}
        eventId={eventId}
        existingTemplateIds={customPredictions.map((cp) => cp.eventCustomPrediction.templateId)}
        onSuccess={onUpdated}
      />

      {/* Edit Dialog */}
      <AddPredictionDialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        eventId={eventId}
        editing={editing}
        onSuccess={onUpdated}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleting(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Prediction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &ldquo;{deleting?.eventCustomPrediction.question}&rdquo;?
              Any user predictions for this question will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
