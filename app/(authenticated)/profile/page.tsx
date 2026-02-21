"use client"

import { useCallback, useEffect, useState } from "react"
import { SiteHeader } from "@/app/components/site-header"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { useTheme, type ColorTheme } from "@/app/components/theme-provider"
import { AvatarSection } from "./avatar-section"
import { AccountSection } from "./account-section"
import { PasswordSection } from "./password-section"

export default function ProfilePage() {
  const { setColorTheme } = useTheme()

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Profile fields
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [savedTheme, setSavedTheme] = useState<string>("neutral")

  // Original values for change detection
  const [originalName, setOriginalName] = useState("")
  const [originalEmail, setOriginalEmail] = useState("")

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
      setLoadError(message)
    } finally {
      setIsLoading(false)
    }
  }, [setColorTheme])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

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
        ) : loadError ? (
          <p className="text-sm text-destructive" role="alert">{loadError}</p>
        ) : (
          <div className="space-y-6">
            <AvatarSection
              image={image}
              initials={initials}
              onImageChange={setImage}
            />

            <AccountSection
              name={name}
              email={email}
              originalName={originalName}
              originalEmail={originalEmail}
              savedTheme={savedTheme}
              onNameChange={setName}
              onEmailChange={setEmail}
              onSaved={({ name: n, email: e, theme }) => {
                setOriginalName(n)
                setOriginalEmail(e)
                setSavedTheme(theme)
              }}
            />

            <PasswordSection />
          </div>
        )}
      </div>
    </>
  )
}
