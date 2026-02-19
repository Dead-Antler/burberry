"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
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
import { apiClient } from "@/app/lib/api-client"
import type { Wrestler } from "@/app/lib/api-types"

interface WrestlerSearchSelectProps {
  value?: string
  onValueChange: (wrestlerId: string) => void
  disabled?: boolean
  placeholder?: string
}

export function WrestlerSearchSelect({
  value,
  onValueChange,
  disabled = false,
  placeholder = "Search for a wrestler...",
}: WrestlerSearchSelectProps) {
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
        console.error('Failed to fetch wrestlers:', error)
      } finally {
        setLoading(false)
      }
    }

    // Fetch wrestlers on mount if we have a value, or when popover opens
    if (wrestlers.length === 0 && (value || open)) {
      fetchWrestlers()
    }
  }, [open, value, wrestlers.length])

  const selectedWrestler = wrestlers.find((w) => w.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedWrestler ? selectedWrestler.currentName : placeholder}
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
                      onSelect={() => {
                        onValueChange(wrestler.id)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === wrestler.id ? "opacity-100" : "opacity-0"
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
  )
}
