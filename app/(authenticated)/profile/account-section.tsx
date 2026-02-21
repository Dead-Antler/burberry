"use client"

import { useState } from "react"
import { Check, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { useTheme, COLOR_THEMES, type ColorTheme } from "@/app/components/theme-provider"

const THEME_COLORS: Record<ColorTheme, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  neutral: "bg-neutral-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  yellow: "bg-yellow-500",
}

interface AccountSectionProps {
  name: string
  email: string
  originalName: string
  originalEmail: string
  savedTheme: string
  onNameChange: (name: string) => void
  onEmailChange: (email: string) => void
  onSaved: (updated: { name: string; email: string; theme: string }) => void
}

export function AccountSection({
  name,
  email,
  originalName,
  originalEmail,
  savedTheme,
  onNameChange,
  onEmailChange,
  onSaved,
}: AccountSectionProps) {
  const { colorTheme, setColorTheme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const hasChanges = name !== originalName || email !== originalEmail || colorTheme !== savedTheme

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const updated = await apiClient.updateProfile({
        name: name || null,
        email,
        theme: colorTheme,
      })
      onSaved({
        name: updated.name ?? "",
        email: updated.email,
        theme: colorTheme,
      })
      setMessage({ type: "success", text: "Profile updated successfully" })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      const text = err instanceof ApiClientError ? err.message : "Failed to update profile"
      setMessage({ type: "error", text })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Update your display name and email address.
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Display Name</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Your display name"
            maxLength={100}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="your@email.com"
            maxLength={255}
            disabled={isSaving}
          />
        </div>

        <Separator />

        {/* Theme Selection */}
        <div className="space-y-3">
          <Label>Color Theme</Label>
          <p className="text-sm text-muted-foreground">
            Choose a color theme for the application.
          </p>
          <div className="flex flex-wrap gap-3">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => setColorTheme(theme)}
                className={`relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                  colorTheme === theme
                    ? "border-primary bg-accent"
                    : "border-transparent hover:border-muted-foreground/25"
                }`}
                aria-label={`${theme} theme`}
                aria-pressed={colorTheme === theme}
              >
                <div className={`h-8 w-8 rounded-full ${THEME_COLORS[theme]}`} />
                <span className="text-xs capitalize">{theme}</span>
                {colorTheme === theme && (
                  <Check className="absolute -top-1 -right-1 h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600"}`} role="alert">
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
