"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, MoreHorizontal, FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { AddPredictionDialog } from "./add-prediction-dialog"
import { ApplyGroupDialog } from "./apply-group-dialog"
import { AnswerSetting } from "./prediction-answer"
import {
  PREDICTION_TYPE_LABELS,
  type EventCustomPredictionWithTemplate,
} from "@/app/lib/api-types"

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
