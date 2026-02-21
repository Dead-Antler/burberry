"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, MoreHorizontal, X, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type {
  PredictionGroup,
  PredictionGroupWithMembers,
  CustomPredictionTemplate,
  PredictionType,
} from "@/app/lib/api-types"

const PREDICTION_TYPE_LABELS: Record<PredictionType, string> = {
  boolean: "Yes/No",
  count: "Count",
  time: "Time",
  wrestler: "Wrestler",
  text: "Text",
}

// ============================================================================
// Group Dialog (Create/Edit)
// ============================================================================

interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: PredictionGroup | null
  onSuccess: (group: PredictionGroup) => void
}

function GroupDialog({ open, onOpenChange, group, onSuccess }: GroupDialogProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = group !== null && group !== undefined

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "")
      setError(null)
    }
  }, [open, group])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Group name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: PredictionGroup
      if (isEditing) {
        result = await apiClient.updatePredictionGroup(group.id, { name: trimmed })
      } else {
        result = await apiClient.createPredictionGroup({ name: trimmed })
      }
      onSuccess(result)
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : isEditing ? "Failed to update group" : "Failed to create group"
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
            <DialogTitle>{isEditing ? "Edit Group" : "Create Group"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the prediction group name."
                : "Create a collection of prediction templates."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., WWE Predictions"
                maxLength={100}
                autoFocus
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing ? "Saving..." : "Creating..."
                : isEditing ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Add Template to Group Dialog
// ============================================================================

interface AddTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  groupId: string
  existingTemplateIds: string[]
  onSuccess: () => void
}

function AddTemplateDialog({ open, onOpenChange, groupId, existingTemplateIds, onSuccess }: AddTemplateDialogProps) {
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

// ============================================================================
// Expanded Group Row
// ============================================================================

interface GroupRowProps {
  group: PredictionGroup
  onEdit: () => void
  onDelete: () => void
}

function GroupRow({ group, onEdit, onDelete }: GroupRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [details, setDetails] = useState<PredictionGroupWithMembers | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchDetails = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.getPredictionGroup(group.id)
      setDetails(data)
    } catch (err) {
      console.error("Failed to load group details:", err)
    } finally {
      setIsLoading(false)
    }
  }, [group.id])

  const handleToggle = () => {
    if (!isExpanded && !details) {
      fetchDetails()
    }
    setIsExpanded(!isExpanded)
  }

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId)
    try {
      await apiClient.removePredictionGroupMember(group.id, memberId)
      await fetchDetails()
    } catch (err) {
      console.error("Failed to remove member:", err)
    } finally {
      setRemovingId(null)
    }
  }

  const handleTemplateAdded = async () => {
    await fetchDetails()
  }

  // We need the members array from the API response to get member IDs for deletion
  // The API returns both templates and members arrays
  const members = (details as PredictionGroupWithMembers & { members?: Array<{ id: string; templateId: string }> })?.members

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between p-3">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1"
          onClick={handleToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{group.name}</span>
          {details && (
            <Badge variant="secondary" className="text-xs">
              {details.templates.length} templates
            </Badge>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${group.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-40" />
            </div>
          ) : details && details.templates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No templates in this group yet.</p>
          ) : details ? (
            <div className="space-y-1">
              {details.templates.map((template, idx) => {
                const member = members?.[idx]
                return (
                  <div key={template.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {PREDICTION_TYPE_LABELS[template.predictionType]}
                      </Badge>
                    </div>
                    {member && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingId === member.id}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setIsAddTemplateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Template
          </Button>

          <AddTemplateDialog
            open={isAddTemplateOpen}
            onOpenChange={setIsAddTemplateOpen}
            groupId={group.id}
            existingTemplateIds={details?.templates.map((t) => t.id) ?? []}
            onSuccess={handleTemplateAdded}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function PredictionGroupsEditor() {
  const [groups, setGroups] = useState<PredictionGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<PredictionGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<PredictionGroup | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchGroups = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.getPredictionGroups()
      setGroups(data)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load groups")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleCreateSuccess = (group: PredictionGroup) => {
    setGroups((prev) => [...prev, group])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updated: PredictionGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    setEditingGroup(null)
  }

  const handleDelete = async () => {
    if (!deletingGroup) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await apiClient.deletePredictionGroup(deletingGroup.id)
      setGroups((prev) => prev.filter((g) => g.id !== deletingGroup.id))
      setDeletingGroup(null)
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete group")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Prediction Groups</CardTitle>
              <CardDescription>
                Create collections of templates to quickly apply to events.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={fetchGroups}>Try Again</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">
                No groups yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  onEdit={() => setEditingGroup(group)}
                  onDelete={() => setDeletingGroup(group)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <GroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <GroupDialog
        open={editingGroup !== null}
        onOpenChange={(open) => { if (!open) setEditingGroup(null) }}
        group={editingGroup}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingGroup(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingGroup?.name}&rdquo;? This will not
              affect templates or existing event predictions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">{deleteError}</p>
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
