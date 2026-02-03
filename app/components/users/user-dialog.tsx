"use client"

import { useEffect, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { User } from "@/app/lib/api-types"

interface UserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: User | null
  currentUserId?: string
  onSuccess: (user: User) => void
}

export function UserDialog({
  open,
  onOpenChange,
  user,
  currentUserId,
  onSuccess,
}: UserDialogProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = user !== null && user !== undefined
  const isEditingSelf = isEditing && user?.id === currentUserId

  // Reset form when dialog opens/closes or user changes
  useEffect(() => {
    if (open) {
      setName(user?.name ?? "")
      setEmail(user?.email ?? "")
      setPassword("")
      setShowPassword(false)
      setIsAdmin(user?.isAdmin ?? false)
      setError(null)
    }
  }, [open, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedEmail = email.trim()
    const trimmedName = name.trim()
    const trimmedPassword = password

    if (!trimmedEmail) {
      setError("Email is required")
      return
    }

    if (!isEditing && !trimmedPassword) {
      setError("Password is required")
      return
    }

    if (trimmedPassword && trimmedPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let result: User
      if (isEditing) {
        result = await apiClient.updateUser(user.id, {
          email: trimmedEmail,
          name: trimmedName || null,
          isAdmin,
          ...(trimmedPassword ? { password: trimmedPassword } : {}),
        })
      } else {
        result = await apiClient.createUser({
          email: trimmedEmail,
          password: trimmedPassword,
          name: trimmedName || null,
          isAdmin,
        })
      }
      onSuccess(result)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : isEditing
          ? "Failed to update user"
          : "Failed to create user"
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
              {isEditing ? "Edit User" : "Create User"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the user details below."
                : "Enter the details for the new user."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                maxLength={255}
                autoFocus={!isEditing}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">
                Password
                {isEditing && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (leave blank to keep unchanged)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="user-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isEditing ? "Enter new password" : "Enter password"}
                  maxLength={128}
                  disabled={isSubmitting}
                  required={!isEditing}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="user-admin" className="flex flex-col items-start gap-1">
                <span>Administrator</span>
                <span className="text-muted-foreground font-normal text-xs">
                  {isEditingSelf
                    ? "You cannot change your own admin status"
                    : "Can manage all data and users"}
                </span>
              </Label>
              <Switch
                id="user-admin"
                checked={isAdmin}
                onCheckedChange={setIsAdmin}
                disabled={isSubmitting || isEditingSelf}
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
                  : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
