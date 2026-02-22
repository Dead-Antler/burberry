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
import type { Wrestler } from "@/app/lib/api-types"

interface ForceDeleteWrestlerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wrestler: Wrestler | null
  onSuccess: (id: string) => void
}

export function ForceDeleteWrestlerDialog({
  open,
  onOpenChange,
  wrestler,
  onSuccess,
}: ForceDeleteWrestlerDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState("")

  const nameMatches = confirmName === wrestler?.currentName

  const handleForceDelete = async () => {
    if (!wrestler || !nameMatches) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiClient.forceDeleteWrestler(wrestler.id)
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
      setConfirmName("")
      onOpenChange(newOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Permanently Delete Wrestler</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{wrestler?.currentName}&rdquo; and
            all associated data including name history, group memberships, match
            participations, and related predictions. This action is irreversible.
            Consider making the wrestler inactive instead unless you understand
            the consequences.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="confirm-wrestler-name" className="text-sm font-medium">
            Type &ldquo;{wrestler?.currentName}&rdquo; to confirm
          </label>
          <Input
            id="confirm-wrestler-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={wrestler?.currentName ?? ""}
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
