"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { TemplateDialog } from "./template-dialog"
import { DeleteTemplateDialog } from "./delete-template-dialog"
import type { CustomPredictionTemplate, PredictionType } from "@/app/lib/api-types"

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
