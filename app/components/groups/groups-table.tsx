"use client"

import { MoreHorizontal, Pencil, Trash2, Users } from "lucide-react"
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
import type { GroupWithMembers } from "@/app/lib/api-types"

interface GroupsTableProps {
  groups: GroupWithMembers[]
  brandMap: Map<string, string>
  isLoading: boolean
  error: string | null
  onEdit: (group: GroupWithMembers) => void
  onDelete: (group: GroupWithMembers) => void
  onManageMembers: (group: GroupWithMembers) => void
  onRetry: () => void
}

function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden sm:table-cell">Brand</TableHead>
          <TableHead className="hidden md:table-cell">Members</TableHead>
          <TableHead className="hidden lg:table-cell">Status</TableHead>
          <TableHead className="w-[70px]">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-5 w-32" />
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Skeleton className="h-5 w-24" />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Skeleton className="h-5 w-16" />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Skeleton className="h-5 w-16" />
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

export function GroupsTable({
  groups,
  brandMap,
  isLoading,
  error,
  onEdit,
  onDelete,
  onManageMembers,
  onRetry,
}: GroupsTableProps) {
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

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <p className="text-sm text-muted-foreground">
            No groups found. Create your first group to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Brand</TableHead>
              <TableHead className="hidden md:table-cell">Members</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
              <TableHead className="w-[70px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const currentMembers = group.members.filter((m) => !m.leftAt)
              return (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {brandMap.get(group.brandId) ?? "Unknown"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {currentMembers.length} member{currentMembers.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant={group.isActive ? "default" : "secondary"}>
                      {group.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Actions for ${group.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onManageMembers(group)}>
                          <Users className="mr-2 h-4 w-4" />
                          Members
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(group)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDelete(group)}
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
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
