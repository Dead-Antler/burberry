"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Brand } from "@/app/lib/api-types"

interface BrandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brand?: Brand | null
  onSuccess: (brand: Brand) => void
}

export function BrandDialog({
  open,
  onOpenChange,
  brand,
  onSuccess,
}: BrandDialogProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = brand !== null && brand !== undefined

  // Reset form when dialog opens/closes or brand changes
  useEffect(() => {
    if (open) {
      setName(brand?.name ?? "")
      setError(null)
    }
  }, [open, brand])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Brand name is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: Brand
      if (isEditing) {
        result = await apiClient.updateBrand(brand.id, { name: trimmedName })
      } else {
        result = await apiClient.createBrand({ name: trimmedName })
      }
      onSuccess(result)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : isEditing
          ? "Failed to update brand"
          : "Failed to create brand"
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
              {isEditing ? "Edit Brand" : "Create Brand"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the brand name below."
                : "Enter a name for the new brand."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Name</Label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., WWE, AEW, NXT"
                maxLength={100}
                autoFocus
                disabled={isSubmitting}
              />
            </div>
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
                  : "Create Brand"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
