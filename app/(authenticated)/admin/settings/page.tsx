"use client"

import { useCallback, useEffect, useState } from "react"
import { Save } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { ReusablePredictionsEditor } from "@/app/components/settings/reusable-predictions-editor"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Setting values
  const [reusablePredictions, setReusablePredictions] = useState<string[]>([])
  const [signupEnabled, setSignupEnabled] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track original values for change detection
  const [originalPredictions, setOriginalPredictions] = useState<string[]>([])
  const [originalSignupEnabled, setOriginalSignupEnabled] = useState(false)

  const fetchSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const settings = await apiClient.getSettings()

      // Find the reusable predictions setting
      const predictionsSetting = settings.find(
        (s) => s.key === "predictions.reusableTemplates"
      )
      const predictions = (predictionsSetting?.value as string[]) || []
      setReusablePredictions(predictions)
      setOriginalPredictions(predictions)

      // Find the signup enabled setting
      const signupSetting = settings.find(
        (s) => s.key === "auth.signupEnabled"
      )
      const signup = (signupSetting?.value as boolean) ?? false
      setSignupEnabled(signup)
      setOriginalSignupEnabled(signup)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load settings"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // Detect changes
  useEffect(() => {
    const predictionsChanged =
      JSON.stringify(reusablePredictions) !== JSON.stringify(originalPredictions)
    const signupChanged = signupEnabled !== originalSignupEnabled
    setHasChanges(predictionsChanged || signupChanged)
  }, [reusablePredictions, originalPredictions, signupEnabled, originalSignupEnabled])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSaveMessage(null)

    try {
      // Save all settings
      await Promise.all([
        apiClient.setSetting(
          "predictions.reusableTemplates",
          reusablePredictions,
          "json"
        ),
        apiClient.setSetting(
          "auth.signupEnabled",
          signupEnabled,
          "boolean"
        ),
      ])

      setOriginalPredictions(reusablePredictions)
      setOriginalSignupEnabled(signupEnabled)
      setHasChanges(false)
      setSaveMessage("Settings saved successfully")

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to save settings"
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Settings" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure global application settings.
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Status messages */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-3">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {saveMessage && (
          <Card className="border-green-500">
            <CardContent className="py-3">
              <p className="text-sm text-green-600">{saveMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Settings sections */}
        {isLoading ? (
          <Card>
            <CardContent className="py-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-96" />
              <div className="space-y-2 pt-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Authentication Section */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Authentication</h2>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Registration</CardTitle>
                  <CardDescription>
                    Control whether new users can sign up for accounts.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="signup-enabled">Enable Sign Up</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow new users to create accounts
                      </p>
                    </div>
                    <Switch
                      id="signup-enabled"
                      checked={signupEnabled}
                      onCheckedChange={setSignupEnabled}
                      disabled={isSaving}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Predictions Section */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Predictions</h2>
              <ReusablePredictionsEditor
                value={reusablePredictions}
                onChange={setReusablePredictions}
                disabled={isSaving}
              />
            </section>
          </div>
        )}

        {/* Unsaved changes indicator */}
        {hasChanges && (
          <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 shadow-lg">
            <p className="text-sm text-yellow-800">
              You have unsaved changes
            </p>
          </div>
        )}
      </div>
    </>
  )
}
