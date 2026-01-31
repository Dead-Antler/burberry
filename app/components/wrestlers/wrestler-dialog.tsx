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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Wrestler, Brand } from "@/app/lib/api-types"

interface WrestlerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wrestler?: Wrestler | null
  brands: Brand[]
  onSuccess: (wrestler: Wrestler) => void
}

export function WrestlerDialog({
  open,
  onOpenChange,
  wrestler,
  brands,
  onSuccess,
}: WrestlerDialogProps) {
  const [currentName, setCurrentName] = useState("")
  const [brandId, setBrandId] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = wrestler !== null && wrestler !== undefined

  // Reset form when dialog opens/closes or wrestler changes
  useEffect(() => {
    if (open) {
      setCurrentName(wrestler?.currentName ?? "")
      setBrandId(wrestler?.brandId ?? (brands[0]?.id ?? ""))
      setIsActive(wrestler?.isActive ?? true)
      setError(brands.length === 0 ? "No brands available. Please create a brand first." : null)
    }
  }, [open, wrestler, brands])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (brands.length === 0) {
      setError("No brands available. Please create a brand first.")
      return
    }

    const trimmedName = currentName.trim()
    if (!trimmedName) {
      setError("Wrestler name is required")
      return
    }
    if (!brandId) {
      setError("Brand is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: Wrestler
      if (isEditing) {
        result = await apiClient.updateWrestler(wrestler.id, {
          currentName: trimmedName,
          brandId,
          isActive,
        })
      } else {
        result = await apiClient.createWrestler({
          currentName: trimmedName,
          brandId,
          isActive,
        })
      }
      onSuccess(result)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : isEditing
          ? "Failed to update wrestler"
          : "Failed to create wrestler"
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
              {isEditing ? "Edit Wrestler" : "Create Wrestler"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the wrestler details below."
                : "Enter details for the new wrestler."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wrestler-brand">Brand</Label>
              <Select
                value={brandId}
                onValueChange={setBrandId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="wrestler-brand">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wrestler-name">Name</Label>
              <Input
                id="wrestler-name"
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
                placeholder="e.g., John Cena"
                maxLength={100}
                autoFocus
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="wrestler-active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive wrestlers won&apos;t appear in match selection.
                </p>
              </div>
              <Switch
                id="wrestler-active"
                checked={isActive}
                onCheckedChange={setIsActive}
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
                  : "Create Wrestler"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
