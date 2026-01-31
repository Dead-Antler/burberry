"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "@/app/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const themeOrder = ["system", "light", "dark"] as const

const themeConfig = {
  system: {
    icon: Monitor,
    label: "System theme",
  },
  light: {
    icon: Sun,
    label: "Light theme",
  },
  dark: {
    icon: Moon,
    label: "Dark theme",
  },
} as const

export function ThemeSwitcher() {
  const [mounted, setMounted] = React.useState(false)
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const cycleTheme = () => {
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  // Show skeleton until mounted to avoid hydration mismatch
  if (!mounted) {
    return <Skeleton className="h-7 w-20 rounded-md" />
  }

  const config = themeConfig[theme]
  const Icon = config.icon

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className="h-7 gap-2"
    >
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
    </Button>
  )
}
