"use client"

import { useMemo } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Crown, GripVertical, HelpCircle, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { GroupBadge } from "@/app/components/ui/group-badge"
import { getParticipantName, groupParticipantsBySharedGroups, type ParticipantDisplay } from "@/app/lib/participant-utils"
import type { MatchWithParticipants, MatchOutcome, MatchParticipantWithData } from "@/app/lib/api-types"

interface MatchesTableProps {
  matches: MatchWithParticipants[]
  isLoading: boolean
  error: string | null
  onEdit: (match: MatchWithParticipants) => void
  onDelete: (match: MatchWithParticipants) => void
  onManageParticipants: (match: MatchWithParticipants) => void
  onRetry: () => void
  onReorder?: (reorderedMatches: MatchWithParticipants[]) => void
  isReorderDisabled?: boolean
}

/**
 * Render participants with group badges placed after contiguous runs of members.
 * E.g., "Dax & Cash <FTR>" instead of "Dax <FTR> & Cash <FTR>"
 *
 * Uses the extracted groupParticipantsBySharedGroups utility for the grouping logic.
 *
 * @param participants - List of participants to render
 * @param separator - Separator between participants (" & " for teams, ", " for free-for-all)
 */
function renderParticipantsWithSharedGroups(
  participants: ParticipantDisplay[],
  separator: React.ReactNode
): React.ReactNode[] {
  if (participants.length === 0) return []

  const runs = groupParticipantsBySharedGroups(participants)
  const result: React.ReactNode[] = []
  let keyIndex = 0

  for (const run of runs) {
    // Emit participants in this run
    for (const p of run.participants) {
      if (result.length > 0) {
        result.push(<span key={`sep-${keyIndex++}`}>{separator}</span>)
      }
      result.push(
        <span key={`p-${keyIndex++}`} className="inline-flex items-center gap-0.5">
          {p.isChampion && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
          {p.name}
        </span>
      )
    }

    // Emit shared group badges after the run
    for (const g of run.sharedGroups) {
      result.push(
        <GroupBadge key={`badge-${keyIndex++}-${g.id}`} groupName={g.name} size="sm" />
      )
    }
  }

  return result
}

function ParticipantsList({ match }: { match: MatchWithParticipants }) {
  if (match.unknownParticipants) {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
        <HelpCircle className="h-4 w-4" />
        <span className="font-medium">TBD</span>
      </span>
    )
  }

  if (!match.participants || match.participants.length === 0) {
    return <span className="text-muted-foreground italic">No participants</span>
  }

  // Helper to extract groups from participant
  const getGroups = (p: MatchParticipantWithData) => {
    // Groups are included in the participant data for wrestlers
    return p.groups || []
  }

  // Group participants by side, preserving champion status and groups
  const sides = new Map<number | null, ParticipantDisplay[]>()
  for (const p of match.participants) {
    const name = getParticipantName(p)
    const existing = sides.get(p.side) || []
    existing.push({ name, isChampion: p.isChampion, groups: getGroups(p) })
    sides.set(p.side, existing)
  }

  // Free-for-all: show as a wrapped list with commas
  if (sides.has(null)) {
    const participants = sides.get(null) || []
    const commaSeparator = <span className="text-muted-foreground">, </span>
    return (
      <div className="flex flex-wrap gap-0.5 items-center">
        {renderParticipantsWithSharedGroups(participants, commaSeparator)}
      </div>
    )
  }

  // Team match: show sides with "vs" between them
  const sideEntries = Array.from(sides.entries()).sort((a, b) => (a[0] || 0) - (b[0] || 0))
  const ampersandSeparator = <span className="text-muted-foreground"> &amp; </span>

  return (
    <div className="flex flex-col gap-0.5">
      {sideEntries.map(([sideNum, participants], index) => (
        <div key={sideNum} className="flex items-center gap-1">
          {index > 0 && (
            <span className="text-xs text-muted-foreground font-medium mr-1">vs</span>
          )}
          <span className="inline-flex flex-wrap items-center gap-0.5">
            {renderParticipantsWithSharedGroups(participants, ampersandSeparator)}
          </span>
        </div>
      ))}
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: MatchOutcome | null }) {
  if (!outcome) {
    return <Badge variant="outline">Pending</Badge>
  }

  const variants: Record<MatchOutcome, "default" | "secondary" | "destructive"> = {
    winner: "default",
    draw: "secondary",
    no_contest: "destructive",
  }

  const labels: Record<MatchOutcome, string> = {
    winner: "Winner",
    draw: "Draw",
    no_contest: "No Contest",
  }

  return <Badge variant={variants[outcome]}>{labels[outcome]}</Badge>
}

function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]"></TableHead>
          <TableHead>Match Type</TableHead>
          <TableHead className="hidden md:table-cell">Participants</TableHead>
          <TableHead className="hidden sm:table-cell">Outcome</TableHead>
          <TableHead className="w-[70px]">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-5 w-5" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-32" />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Skeleton className="h-5 w-48" />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Skeleton className="h-5 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-8 w-8" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface SortableRowProps {
  match: MatchWithParticipants
  onEdit: (match: MatchWithParticipants) => void
  onDelete: (match: MatchWithParticipants) => void
  onManageParticipants: (match: MatchWithParticipants) => void
  isReorderDisabled: boolean
}

function SortableRow({
  match,
  onEdit,
  onDelete,
  onManageParticipants,
  isReorderDisabled,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: match.id, disabled: isReorderDisabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[50px]">
        {!isReorderDisabled ? (
          <button
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        ) : (
          <span className="text-muted-foreground text-sm pl-1">{match.matchOrder}</span>
        )}
      </TableCell>
      <TableCell>{match.matchType}</TableCell>
      <TableCell className="hidden md:table-cell">
        <ParticipantsList match={match} />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <OutcomeBadge outcome={match.outcome} />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for match ${match.matchOrder}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!match.unknownParticipants && (
              <DropdownMenuItem onClick={() => onManageParticipants(match)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Participants
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onEdit(match)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(match)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

export function MatchesTable({
  matches,
  isLoading,
  error,
  onEdit,
  onDelete,
  onManageParticipants,
  onRetry,
  onReorder,
  isReorderDisabled = false,
}: MatchesTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sort matches by matchOrder
  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => a.matchOrder - b.matchOrder),
    [matches]
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sortedMatches.findIndex((m) => m.id === active.id)
      const newIndex = sortedMatches.findIndex((m) => m.id === over.id)

      const reordered = arrayMove(sortedMatches, oldIndex, newIndex)
      onReorder?.(reordered)
    }
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <p className="text-sm text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="py-0 overflow-hidden">
        <CardContent className="p-0">
          <TableSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (matches.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">
            No matches found. Add your first match to this event.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  {isReorderDisabled ? "Order" : ""}
                </TableHead>
                <TableHead>Match Type</TableHead>
                <TableHead className="hidden md:table-cell">Participants</TableHead>
                <TableHead className="hidden sm:table-cell">Outcome</TableHead>
                <TableHead className="w-[70px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <SortableContext
                items={sortedMatches.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedMatches.map((match) => (
                  <SortableRow
                    key={match.id}
                    match={match}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onManageParticipants={onManageParticipants}
                    isReorderDisabled={isReorderDisabled}
                  />
                ))}
              </SortableContext>
            </TableBody>
          </Table>
        </DndContext>
      </CardContent>
    </Card>
  )
}
