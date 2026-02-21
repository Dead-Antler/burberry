"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { apiClient } from "@/app/lib/api-client"
import type { Wrestler } from "@/app/lib/api-types"

interface WrestlerMultiSelectProps {
  value: string[]
  onValueChange: (wrestlerIds: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function WrestlerMultiSelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select wrestlers...",
}: WrestlerMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchWrestlers = async () => {
      setLoading(true)
      try {
        const data = await apiClient.getAllWrestlers({ isActive: true })
        setWrestlers(data as Wrestler[])
      } catch (error) {
        console.error("Failed to fetch wrestlers:", error)
      } finally {
        setLoading(false)
      }
    }

    if (wrestlers.length === 0 && (value.length > 0 || open)) {
      fetchWrestlers()
    }
  }, [open, value.length, wrestlers.length])

  const selectedWrestlers = wrestlers.filter((w) => value.includes(w.id))

  const toggleWrestler = (wrestlerId: string) => {
    if (value.includes(wrestlerId)) {
      onValueChange(value.filter((id) => id !== wrestlerId))
    } else {
      onValueChange([...value, wrestlerId])
    }
  }

  const removeWrestler = (wrestlerId: string) => {
    onValueChange(value.filter((id) => id !== wrestlerId))
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedWrestlers.length > 0
              ? `${selectedWrestlers.length} wrestler${selectedWrestlers.length !== 1 ? "s" : ""} selected`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <Command>
            <CommandInput placeholder="Search wrestlers..." />
            <CommandList>
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  Loading wrestlers...
                </div>
              ) : (
                <>
                  <CommandEmpty>No wrestler found.</CommandEmpty>
                  <CommandGroup>
                    {wrestlers.map((wrestler) => (
                      <CommandItem
                        key={wrestler.id}
                        value={wrestler.currentName}
                        onSelect={() => toggleWrestler(wrestler.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value.includes(wrestler.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {wrestler.currentName}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected wrestlers as removable badges */}
      {selectedWrestlers.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {selectedWrestlers.map((wrestler) => (
            <Badge key={wrestler.id} variant="secondary" className="text-xs gap-1">
              {wrestler.currentName}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeWrestler(wrestler.id)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
