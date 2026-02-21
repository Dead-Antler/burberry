"use client"

import { useRef, useState } from "react"
import { Camera, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { apiClient, ApiClientError } from "@/app/lib/api-client"

interface AvatarSectionProps {
  image: string | null
  initials: string
  onImageChange: (image: string | null) => void
}

export function AvatarSection({ image, initials, onImageChange }: AvatarSectionProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setMessage(null)

    try {
      const result = await apiClient.uploadAvatar(file)
      onImageChange(result.image)
      setMessage({ type: "success", text: "Avatar uploaded" })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      const text = err instanceof ApiClientError ? err.message : "Failed to upload avatar"
      setMessage({ type: "error", text })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemove = async () => {
    setIsUploading(true)
    setMessage(null)

    try {
      await apiClient.deleteAvatar()
      onImageChange(null)
      setMessage({ type: "success", text: "Avatar removed" })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      const text = err instanceof ApiClientError ? err.message : "Failed to remove avatar"
      setMessage({ type: "error", text })
    } finally {
      setIsUploading(false)
    }
  }

  return (
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
                disabled={isUploading}
              >
                {isUploading ? (
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
                  onClick={handleRemove}
                  disabled={isUploading}
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
              onChange={handleUpload}
            />
            {message && (
              <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600"}`} role="alert">
                {message.text}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
