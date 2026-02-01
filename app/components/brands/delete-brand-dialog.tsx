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
import type { Brand } from "@/app/lib/api-types"

interface DeleteBrandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brand: Brand | null
  onSuccess: (deletedId: string) => void
}

export function DeleteBrandDialog({
  open,
  onOpenChange,
  brand,
  onSuccess,
}: DeleteBrandDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!brand) return

    setIsDeleting(true)
    setError(null)

    try {
      await apiClient.deleteBrand(brand.id)
      setIsDeleting(false)
      onSuccess(brand.id)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to delete brand"
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
          <AlertDialogTitle>Delete Brand</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &ldquo;{brand?.name}&rdquo;? This
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
