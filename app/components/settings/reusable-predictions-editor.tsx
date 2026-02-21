"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { CustomPredictionTemplate, PredictionType, ScoringMode } from "@/app/lib/api-types"

const PREDICTION_TYPES: { value: PredictionType; label: string }[] = [
  { value: "boolean", label: "Yes/No" },
  { value: "count", label: "Count" },
  { value: "time", label: "Time" },
  { value: "wrestler", label: "Wrestler" },
  { value: "text", label: "Text" },
]

function predictionTypeLabel(type: PredictionType): string {
  return PREDICTION_TYPES.find((t) => t.value === type)?.label ?? type
}

// ============================================================================
// Template Dialog (Create/Edit)
// ============================================================================

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: CustomPredictionTemplate | null
  onSuccess: (template: CustomPredictionTemplate) => void
}

function TemplateDialog({
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
                    Only the closest prediction(s) that don't exceed the answer earn a point. If everyone goes over, nobody scores.
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

// ============================================================================
// Delete Template Dialog
// ============================================================================

interface DeleteTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: CustomPredictionTemplate | null
  onSuccess: (deletedId: string) => void
}

function DeleteTemplateDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: DeleteTemplateDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!template) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiClient.deleteCustomPredictionTemplate(template.id)
      setIsDeleting(false)
      onSuccess(template.id)
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to delete template"
      setError(message)
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isDeleting) {
      setError(null)
      onOpenChange(newOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{template?.name}&rdquo;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
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
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CustomPredictionTemplatesEditor() {
  const [templates, setTemplates] = useState<CustomPredictionTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CustomPredictionTemplate | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState<CustomPredictionTemplate | null>(null)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.getCustomPredictionTemplates()
      setTemplates(data)
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to load templates"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleCreateSuccess = (template: CustomPredictionTemplate) => {
    setTemplates((prev) => [...prev, template])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updated: CustomPredictionTemplate) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    )
    setEditingTemplate(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== deletedId))
    setDeletingTemplate(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Custom Prediction Templates</CardTitle>
              <CardDescription>
                Define reusable templates for custom event predictions.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsCreateDialogOpen(true)}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center py-10 px-6">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={fetchTemplates}>
                Try Again
              </Button>
            </div>
          ) : isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Default Question</TableHead>
                  <TableHead className="w-[70px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6">
              <p className="text-sm text-muted-foreground">
                No templates yet. Add your first one to get started.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Default Question</TableHead>
                  <TableHead className="w-[70px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="secondary">
                          {predictionTypeLabel(template.predictionType)}
                        </Badge>
                        {template.scoringMode === "closest_under" && (
                          <Badge variant="outline" className="text-xs">
                            Closest
                          </Badge>
                        )}
                        {template.cooldownDays && (
                          <Badge variant="outline" className="text-xs">
                            {template.cooldownDays}d
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {template.description || "\u2014"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${template.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingTemplate(template)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <TemplateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <TemplateDialog
        open={editingTemplate !== null}
        onOpenChange={(open) => { if (!open) setEditingTemplate(null) }}
        template={editingTemplate}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Dialog */}
      <DeleteTemplateDialog
        open={deletingTemplate !== null}
        onOpenChange={(open) => { if (!open) setDeletingTemplate(null) }}
        template={deletingTemplate}
        onSuccess={handleDeleteSuccess}
      />
    </>
  )
}
