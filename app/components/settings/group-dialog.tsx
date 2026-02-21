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
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { PredictionGroup } from "@/app/lib/api-types"

interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: PredictionGroup | null
  onSuccess: (group: PredictionGroup) => void
}

export function GroupDialog({ open, onOpenChange, group, onSuccess }: GroupDialogProps) {
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
