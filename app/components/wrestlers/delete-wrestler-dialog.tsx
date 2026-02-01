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
import type { Wrestler } from "@/app/lib/api-types"

interface DeleteWrestlerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wrestler: Wrestler | null
  onSuccess: (deletedId: string) => void
}

export function DeleteWrestlerDialog({
  open,
  onOpenChange,
  wrestler,
  onSuccess,
}: DeleteWrestlerDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!wrestler) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiClient.deleteWrestler(wrestler.id)
      setIsDeleting(false)
      onSuccess(wrestler.id)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to delete wrestler"
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
          <AlertDialogTitle>Delete Wrestler</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{wrestler?.currentName}&rdquo;? This
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
