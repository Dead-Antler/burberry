"use client"

import { useCallback, useState } from "react"
import { Plus, Pencil, Trash2, MoreHorizontal, X, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient } from "@/app/lib/api-client"
import { AddTemplateDialog } from "./add-template-dialog"
import {
  PREDICTION_TYPE_LABELS,
  type PredictionGroup,
  type PredictionGroupWithMembers,
} from "@/app/lib/api-types"

interface GroupRowProps {
  group: PredictionGroup
  onEdit: () => void
  onDelete: () => void
}

export function GroupRow({ group, onEdit, onDelete }: GroupRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [details, setDetails] = useState<PredictionGroupWithMembers | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const fetchDetails = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await apiClient.getPredictionGroup(group.id)
      setDetails(data)
    } catch (err) {
      console.error("Failed to load group details:", err)
    } finally {
      setIsLoading(false)
    }
  }, [group.id])

  const handleToggle = () => {
    if (!isExpanded && !details) {
      fetchDetails()
    }
    setIsExpanded(!isExpanded)
  }

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId)
    try {
      await apiClient.removePredictionGroupMember(group.id, memberId)
      await fetchDetails()
    } catch (err) {
      console.error("Failed to remove member:", err)
    } finally {
      setRemovingId(null)
    }
  }

  const handleTemplateAdded = async () => {
    await fetchDetails()
  }

  // We need the members array from the API response to get member IDs for deletion
  // The API returns both templates and members arrays
  const members = (details as PredictionGroupWithMembers & { members?: Array<{ id: string; templateId: string }> })?.members

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between p-3">
        <button
          type="button"
          className="flex items-center gap-2 text-left flex-1"
          onClick={handleToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{group.name}</span>
          {details && (
            <Badge variant="secondary" className="text-xs">
              {details.templates.length} templates
            </Badge>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Actions for ${group.name}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {isLoading ? (
            <div className="space-y-2 py-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-6 w-40" />
            </div>
          ) : details && details.templates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No templates in this group yet.</p>
          ) : details ? (
            <div className="space-y-1">
              {details.templates.map((template, idx) => {
                const member = members?.[idx]
                return (
                  <div key={template.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {PREDICTION_TYPE_LABELS[template.predictionType]}
                      </Badge>
                    </div>
                    {member && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={removingId === member.id}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setIsAddTemplateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Template
          </Button>

          <AddTemplateDialog
            open={isAddTemplateOpen}
            onOpenChange={setIsAddTemplateOpen}
            groupId={group.id}
            existingTemplateIds={details?.templates.map((t) => t.id) ?? []}
            onSuccess={handleTemplateAdded}
          />
        </div>
      )}
    </div>
  )
}
