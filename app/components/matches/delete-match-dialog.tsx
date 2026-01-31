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
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { MatchWithParticipants } from "@/app/lib/api-types"

interface DeleteMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: MatchWithParticipants | null
  onSuccess: (deletedId: string) => void
}

export function DeleteMatchDialog({
  open,
  onOpenChange,
  match,
  onSuccess,
}: DeleteMatchDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!match) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiClient.deleteMatch(match.id)
      onSuccess(match.id)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to delete match"
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
          <AlertDialogTitle>Delete Match</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this {match?.matchType} match? This
            will also delete all associated predictions. This action cannot be
            undone.
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
