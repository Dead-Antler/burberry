"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Camera, Check, Eye, EyeOff, Save, Trash2, Upload } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
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

export default function ProfilePage() {
  const { colorTheme, setColorTheme } = useTheme()

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Messages
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [avatarMessage, setAvatarMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Profile fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [savedTheme, setSavedTheme] = useState<string>("neutral")

  // Original values for change detection
  const [originalName, setOriginalName] = useState("")
  const [originalEmail, setOriginalEmail] = useState("")

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasProfileChanges = name !== originalName || email !== originalEmail || colorTheme !== savedTheme
  const hasPasswordInput = currentPassword || newPassword || confirmPassword

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const profile = await apiClient.getProfile()
      setName(profile.name ?? "")
      setEmail(profile.email)
      setImage(profile.image)
      setOriginalName(profile.name ?? "")
      setOriginalEmail(profile.email)

      const theme = (profile.theme ?? "neutral") as ColorTheme
      setSavedTheme(theme)
      setColorTheme(theme)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to load profile"
      setProfileMessage({ type: "error", text: message })
    } finally {
      setIsLoading(false)
    }
  }, [setColorTheme])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    setProfileMessage(null)

    try {
      const updated = await apiClient.updateProfile({
        name: name || null,
        email,
        theme: colorTheme,
      })
      setOriginalName(updated.name ?? "")
      setOriginalEmail(updated.email)
      setSavedTheme(colorTheme)
      setProfileMessage({ type: "success", text: "Profile updated successfully" })
      setTimeout(() => setProfileMessage(null), 3000)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to update profile"
      setProfileMessage({ type: "error", text: message })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    setIsSavingPassword(true)
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" })
      setIsSavingPassword(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters" })
      setIsSavingPassword(false)
      return
    }

    try {
      await apiClient.changePassword({ currentPassword, newPassword, confirmPassword })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordMessage({ type: "success", text: "Password changed successfully" })
      setTimeout(() => setPasswordMessage(null), 3000)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to change password"
      setPasswordMessage({ type: "error", text: message })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAvatar(true)
    setAvatarMessage(null)

    try {
      const result = await apiClient.uploadAvatar(file)
      setImage(result.image)
      setAvatarMessage({ type: "success", text: "Avatar uploaded" })
      setTimeout(() => setAvatarMessage(null), 3000)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to upload avatar"
      setAvatarMessage({ type: "error", text: message })
    } finally {
      setIsUploadingAvatar(false)
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true)
    setAvatarMessage(null)

    try {
      await apiClient.deleteAvatar()
      setImage(null)
      setAvatarMessage({ type: "success", text: "Avatar removed" })
      setTimeout(() => setAvatarMessage(null), 3000)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Failed to remove avatar"
      setAvatarMessage({ type: "error", text: message })
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <>
      <SiteHeader breadcrumbs={[{ label: "Profile" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="py-6 space-y-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Avatar Section */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>
                  Upload a profile picture. Max 2MB, JPEG/PNG/GIF/WebP.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    {image && <AvatarImage src={image} alt="Profile picture" />}
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <Upload className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="mr-2 h-4 w-4" />
                        )}
                        {image ? "Change" : "Upload"}
                      </Button>
                      {image && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveAvatar}
                          disabled={isUploadingAvatar}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    {avatarMessage && (
                      <p className={`text-sm ${avatarMessage.type === "error" ? "text-destructive" : "text-green-600"}`} role="alert">
                        {avatarMessage.text}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Info Section */}
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
                    onClick={handleSaveProfile}
                    disabled={!hasProfileChanges || isSavingProfile}
                    size="sm"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingProfile ? "Saving..." : "Save"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Display Name</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                    maxLength={100}
                    disabled={isSavingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    maxLength={255}
                    disabled={isSavingProfile}
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

                {profileMessage && (
                  <p className={`text-sm ${profileMessage.type === "error" ? "text-destructive" : "text-green-600"}`} role="alert">
                    {profileMessage.text}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Password Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                      Update your password. You must provide your current password.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={!hasPasswordInput || isSavingPassword}
                    size="sm"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingPassword ? "Changing..." : "Change Password"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={isSavingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      disabled={isSavingPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSavingPassword}
                  />
                </div>
                {passwordMessage && (
                  <p className={`text-sm ${passwordMessage.type === "error" ? "text-destructive" : "text-green-600"}`} role="alert">
                    {passwordMessage.text}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
