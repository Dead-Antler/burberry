"use client"

import * as React from "react"
import { AlertTriangle, Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface FuzzyComboboxOption {
  value: string
  label: string
  /** Show a warning indicator next to this option */
  warning?: boolean
  /** Tooltip text for the warning indicator */
  warningTooltip?: string
}

interface FuzzyComboboxProps {
  options: FuzzyComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

/**
 * Fuzzy matching algorithm that supports:
 * 1. Case-insensitive substring matching ("swerve str" matches "Swerve Strickland")
 * 2. Initials/acronym matching ("mjf" matches "Maxwell Jacob Friedman")
 * 3. Consecutive first-letter matching ("ss" matches "Swerve Strickland")
 */
function fuzzyMatch(query: string, target: string): { matches: boolean; score: number } {
  const queryLower = query.toLowerCase().trim()
  const targetLower = target.toLowerCase()

  if (!queryLower) {
    return { matches: true, score: 0 }
  }

  // Exact match gets highest score
  if (targetLower === queryLower) {
    return { matches: true, score: 100 }
  }

  // Starts with query gets high score
  if (targetLower.startsWith(queryLower)) {
    return { matches: true, score: 90 }
  }

  // Contains query as substring
  if (targetLower.includes(queryLower)) {
    return { matches: true, score: 80 }
  }

  // Initials matching - each query char matches start of a word
  // "mjf" matches "Maxwell Jacob Friedman"
  const words = target.split(/\s+/).filter((w) => w.length > 0)
  const initials = words.map((w) => w[0].toLowerCase()).join("")

  if (initials.includes(queryLower)) {
    return { matches: true, score: 70 }
  }

  // Consecutive first-letter matching
  // Check if query chars match the start of consecutive words
  // "ss" matches "Swerve Strickland"
  let wordIndex = 0
  let queryIndex = 0

  while (queryIndex < queryLower.length && wordIndex < words.length) {
    const word = words[wordIndex].toLowerCase()
    if (word.startsWith(queryLower[queryIndex])) {
      queryIndex++
    }
    wordIndex++
  }

  if (queryIndex === queryLower.length) {
    return { matches: true, score: 60 }
  }

  // Fuzzy character matching - all query chars appear in order
  let targetIndex = 0
  queryIndex = 0

  while (queryIndex < queryLower.length && targetIndex < targetLower.length) {
    if (queryLower[queryIndex] === targetLower[targetIndex]) {
      queryIndex++
    }
    targetIndex++
  }

  if (queryIndex === queryLower.length) {
    // Score based on how spread out the matches are (tighter = better)
    const spread = targetIndex / targetLower.length
    return { matches: true, score: Math.round(50 * (1 - spread) + 20) }
  }

  return { matches: false, score: 0 }
}

function filterAndSortOptions(
  options: FuzzyComboboxOption[],
  query: string
): FuzzyComboboxOption[] {
  if (!query.trim()) {
    return options
  }

  const scored = options
    .map((option) => ({
      option,
      ...fuzzyMatch(query, option.label),
    }))
    .filter((item) => item.matches)
    .sort((a, b) => b.score - a.score)

  return scored.map((item) => item.option)
}

export function FuzzyCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
}: FuzzyComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filteredOptions = React.useMemo(
    () => filterAndSortOptions(options, query),
    [options, query]
  )

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("flex items-center gap-1", !selectedOption && "text-muted-foreground")}>
            {selectedOption?.label ?? placeholder}
            {selectedOption?.warning && (
              <span title={selectedOption.warningTooltip}>
                <AlertTriangle
                  className="h-4 w-4 text-amber-500 shrink-0"
                  aria-label={selectedOption.warningTooltip}
                />
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1">{option.label}</span>
                  {option.warning && (
                    <span title={option.warningTooltip}>
                      <AlertTriangle
                        className="ml-2 h-4 w-4 text-amber-500 shrink-0"
                        aria-label={option.warningTooltip}
                      />
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
