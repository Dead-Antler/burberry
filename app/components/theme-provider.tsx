"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"
export type ColorTheme = "blue" | "green" | "neutral" | "orange" | "red" | "rose" | "violet" | "yellow"

export const COLOR_THEMES: ColorTheme[] = ["blue", "green", "neutral", "orange", "red", "rose", "violet", "yellow"]

type ThemeProviderContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
  colorTheme: ColorTheme
  setColorTheme: (theme: ColorTheme) => void
}

const ThemeProviderContext = React.createContext<ThemeProviderContextValue | undefined>(undefined)

const STORAGE_KEY = "theme"
const COLOR_THEME_KEY = "color-theme"

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">("light")
  const [colorTheme, setColorThemeState] = React.useState<ColorTheme>("neutral")
  const [mounted, setMounted] = React.useState(false)

  // Initialize theme from localStorage on mount
  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored)
    }
    const storedColor = localStorage.getItem(COLOR_THEME_KEY) as ColorTheme | null
    if (storedColor && COLOR_THEMES.includes(storedColor)) {
      setColorThemeState(storedColor)
    }
    setMounted(true)
  }, [])

  // Update resolved theme and apply class
  React.useEffect(() => {
    if (!mounted) return

    const resolved = theme === "system" ? getSystemTheme() : theme
    setResolvedTheme(resolved)

    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolved)
  }, [theme, mounted])

  // Apply color theme attribute
  React.useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    if (colorTheme === "neutral") {
      root.removeAttribute("data-theme")
    } else {
      root.dataset.theme = colorTheme
    }
  }, [colorTheme, mounted])

  // Listen for system theme changes
  React.useEffect(() => {
    if (!mounted || theme !== "system") return

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const handleChange = () => {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      document.documentElement.classList.remove("light", "dark")
      document.documentElement.classList.add(resolved)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme, mounted])

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
  }, [])

  const setColorTheme = React.useCallback((newTheme: ColorTheme) => {
    setColorThemeState(newTheme)
    localStorage.setItem(COLOR_THEME_KEY, newTheme)
    if (newTheme === "neutral") {
      document.documentElement.removeAttribute("data-theme")
    } else {
      document.documentElement.dataset.theme = newTheme
    }
  }, [])

  const value = React.useMemo(
    () => ({ theme, setTheme, resolvedTheme, colorTheme, setColorTheme }),
    [theme, setTheme, resolvedTheme, colorTheme, setColorTheme]
  )

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
