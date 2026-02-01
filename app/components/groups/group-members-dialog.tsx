"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { FuzzyCombobox, type FuzzyComboboxOption } from "@/components/ui/fuzzy-combobox"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { GroupWithMembers, GroupMemberWithWrestler, Wrestler } from "@/app/lib/api-types"

interface GroupMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: GroupWithMembers | null
  wrestlers: Wrestler[]
  brandMap: Map<string, string>
  onMembersChange: (groupId: string, members: GroupMemberWithWrestler[]) => void
}

export function GroupMembersDialog({
  open,
  onOpenChange,
  group,
  wrestlers,
  brandMap,
  onMembersChange,
}: GroupMembersDialogProps) {
  const [members, setMembers] = useState<GroupMemberWithWrestler[]>([])
  const [selectedWrestlerId, setSelectedWrestlerId] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get current (active) members
  const currentMembers = members.filter((m) => !m.leftAt)
  const currentMemberWrestlerIds = new Set(currentMembers.map((m) => m.wrestlerId))

  // Reset state when dialog opens
  useEffect(() => {
    if (open && group) {
      setMembers(group.members)
      setSelectedWrestlerId("")
      setError(null)
    }
  }, [open, group])

  // Build wrestler options, excluding those already in the group
  const wrestlerOptions: FuzzyComboboxOption[] = wrestlers
    .filter((w) => w.isActive && !currentMemberWrestlerIds.has(w.id))
    .map((w) => ({
      value: w.id,
      label: w.currentName,
      group: brandMap.get(w.brandId),
    }))

  const handleAddMember = async () => {
    if (!group || !selectedWrestlerId) return

    setIsAdding(true)
    setError(null)

    try {
      const result = await apiClient.addGroupMember(group.id, {
        wrestlerId: selectedWrestlerId,
      })

      // Find the wrestler name for the new member
      const wrestler = wrestlers.find((w) => w.id === selectedWrestlerId)
      const newMember: GroupMemberWithWrestler = {
        ...result,
        wrestlerName: wrestler?.currentName ?? "Unknown",
      }

      const updatedMembers = [...members, newMember]
      setMembers(updatedMembers)
      onMembersChange(group.id, updatedMembers)
      setSelectedWrestlerId("")
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to add member"
      setError(message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!group) return

    setRemovingMemberId(memberId)
    setError(null)

    try {
      await apiClient.removeGroupMember(group.id, memberId)

      // Update the member's leftAt locally
      const updatedMembers = members.map((m) =>
        m.id === memberId ? { ...m, leftAt: new Date().toISOString() } : m
      )
      setMembers(updatedMembers)
      onMembersChange(group.id, updatedMembers)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to remove member"
      setError(message)
    } finally {
      setRemovingMemberId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Members</DialogTitle>
          <DialogDescription>
            Add or remove wrestlers from &ldquo;{group?.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add member section */}
          <div className="flex gap-2">
            <div className="flex-1">
              <FuzzyCombobox
                options={wrestlerOptions}
                value={selectedWrestlerId}
                onValueChange={setSelectedWrestlerId}
                placeholder="Select wrestler to add..."
                searchPlaceholder="Search wrestlers..."
                emptyMessage="No available wrestlers."
                disabled={isAdding || wrestlerOptions.length === 0}
              />
            </div>
            <Button
              onClick={handleAddMember}
              disabled={!selectedWrestlerId || isAdding}
              size="icon"
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">Add member</span>
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Current members list */}
          {currentMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No members in this group yet.
            </p>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wrestler</TableHead>
                    <TableHead className="w-[70px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentMembers.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.wrestlerName}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingMemberId === member.id}
                          className="text-destructive hover:text-destructive"
                          aria-label={`Remove ${member.wrestlerName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
