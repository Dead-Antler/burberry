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
import type { Group } from "@/app/lib/api-types"

interface DeactivateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
  onSuccess: (id: string) => void
}

export function DeactivateGroupDialog({
  open,
  onOpenChange,
  group,
  onSuccess,
}: DeactivateGroupDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDeactivate = async () => {
    if (!group) return

    setIsLoading(true)
    setError(null)

    try {
      await apiClient.deleteGroup(group.id)
      setIsLoading(false)
      onSuccess(group.id)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to deactivate group"
      setError(message)
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      setError(null)
      onOpenChange(newOpen)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Make Inactive</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to make &ldquo;{group?.name}&rdquo; inactive?
            The group will be hidden from active lists but can be reactivated later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeactivate}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deactivating..." : "Make Inactive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
