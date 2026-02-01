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
import type { Group, Brand } from "@/app/lib/api-types"

interface GroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: Group | null
  brands: Brand[]
  onSuccess: (group: Group) => void
}

export function GroupDialog({
  open,
  onOpenChange,
  group,
  brands,
  onSuccess,
}: GroupDialogProps) {
  const [name, setName] = useState("")
  const [brandId, setBrandId] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = group !== null && group !== undefined

  // Reset form when dialog opens/closes or group changes
  useEffect(() => {
    if (open) {
      setName(group?.name ?? "")
      setBrandId(group?.brandId ?? (brands[0]?.id ?? ""))
      setIsActive(group?.isActive ?? true)
      setError(brands.length === 0 ? "No brands available. Please create a brand first." : null)
    }
  }, [open, group, brands])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (brands.length === 0) {
      setError("No brands available. Please create a brand first.")
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Group name is required")
      return
    }
    if (!brandId) {
      setError("Brand is required")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: Group
      if (isEditing) {
        result = await apiClient.updateGroup(group.id, {
          name: trimmedName,
          brandId,
          isActive,
        })
      } else {
        result = await apiClient.createGroup({
          name: trimmedName,
          brandId,
          isActive,
        })
      }
      onSuccess(result)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : isEditing
          ? "Failed to update group"
          : "Failed to create group"
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
              {isEditing ? "Edit Group" : "Create Group"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the group details below."
                : "Enter details for the new group."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-brand">Brand</Label>
              <Select
                value={brandId}
                onValueChange={setBrandId}
                disabled={isSubmitting}
              >
                <SelectTrigger id="group-brand">
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
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., The Bloodline"
                maxLength={100}
                autoFocus
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="group-active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive groups won&apos;t appear in match selection.
                </p>
              </div>
              <Switch
                id="group-active"
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
                  : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
