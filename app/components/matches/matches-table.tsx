"use client"

import { Crown, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"
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
import { getParticipantName } from "@/app/lib/participant-utils"
import type { MatchWithParticipants, MatchOutcome } from "@/app/lib/api-types"

interface MatchesTableProps {
  matches: MatchWithParticipants[]
  isLoading: boolean
  error: string | null
  onEdit: (match: MatchWithParticipants) => void
  onDelete: (match: MatchWithParticipants) => void
  onManageParticipants: (match: MatchWithParticipants) => void
  onRetry: () => void
}

function ParticipantsList({ match }: { match: MatchWithParticipants }) {
  if (!match.participants || match.participants.length === 0) {
    return <span className="text-muted-foreground italic">No participants</span>
  }

  // Group participants by side, preserving champion status
  const sides = new Map<number | null, Array<{ name: string; isChampion: boolean }>>()
  for (const p of match.participants) {
    const name = getParticipantName(p)
    const existing = sides.get(p.side) || []
    existing.push({ name, isChampion: p.isChampion })
    sides.set(p.side, existing)
  }

  // Free-for-all: show as a wrapped list
  if (sides.has(null)) {
    const participants = sides.get(null) || []
    return (
      <div className="flex flex-wrap gap-1">
        {participants.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            {p.isChampion && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
            {p.name}
            {i < participants.length - 1 && <span className="text-muted-foreground">,</span>}
          </span>
        ))}
      </div>
    )
  }

  // Team match: show sides with "vs" between them
  const sideEntries = Array.from(sides.entries()).sort((a, b) => (a[0] || 0) - (b[0] || 0))

  return (
    <div className="flex flex-col gap-0.5">
      {sideEntries.map(([sideNum, participants], index) => (
        <div key={sideNum} className="flex items-center gap-1">
          {index > 0 && (
            <span className="text-xs text-muted-foreground font-medium mr-1">vs</span>
          )}
          <span>
            {participants.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-0.5">
                {p.isChampion && <Crown className="h-3 w-3 text-yellow-500 shrink-0" />}
                {p.name}
                {i < participants.length - 1 && (
                  <span className="text-muted-foreground"> &amp; </span>
                )}
              </span>
            ))}
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
          <TableHead className="w-[60px]">Order</TableHead>
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
              <Skeleton className="h-5 w-8" />
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

export function MatchesTable({
  matches,
  isLoading,
  error,
  onEdit,
  onDelete,
  onManageParticipants,
  onRetry,
}: MatchesTableProps) {
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

  // Sort matches by matchOrder
  const sortedMatches = [...matches].sort((a, b) => a.matchOrder - b.matchOrder)

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Order</TableHead>
              <TableHead>Match Type</TableHead>
              <TableHead className="hidden md:table-cell">Participants</TableHead>
              <TableHead className="hidden sm:table-cell">Outcome</TableHead>
              <TableHead className="w-[70px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMatches.map((match) => (
              <TableRow key={match.id}>
                <TableCell className="font-medium">{match.matchOrder}</TableCell>
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
                      <DropdownMenuItem onClick={() => onManageParticipants(match)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Participants
                      </DropdownMenuItem>
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
