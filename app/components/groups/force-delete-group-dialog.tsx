"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Group } from "@/app/lib/api-types"

interface ForceDeleteGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
  onSuccess: (id: string) => void
}

export function ForceDeleteGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: ForceDeleteGroupDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState("")

  const nameMatches = confirmName === group?.name

  const handleForceDelete = async () => {
    if (!group || !nameMatches) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiClient.forceDeleteGroup(group.id)
      setIsDeleting(false)
      onSuccess(group.id)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to delete group"
      setError(message)
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isDeleting) {
      setError(null)
      setConfirmName("")
      onOpenChange(newOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete Group</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{group?.name}&rdquo; and all
            associated data including member history, match participations, and
            related predictions. This action is irreversible. Consider making the
            group inactive instead unless you understand the consequences.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="confirm-group-name" className="text-sm font-medium">
            Type &ldquo;{group?.name}&rdquo; to confirm
          </label>
          <Input
            id="confirm-group-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={group?.name ?? ""}
            disabled={isDeleting}
          />
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleForceDelete}
            disabled={isDeleting || !nameMatches}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Permanently Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
