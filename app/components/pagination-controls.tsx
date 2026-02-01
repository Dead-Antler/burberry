"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { PaginationInfo } from "@/app/lib/api-types"

interface PaginationControlsProps {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function PaginationControls({
  pagination,
  onPageChange,
  isLoading = false,
}: PaginationControlsProps) {
  const { page, totalPages, total, limit, hasPrev, hasNext } = pagination

  if (totalPages <= 1) return null

  const startItem = (page - 1) * limit + 1
  const endItem = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <p className="text-sm text-muted-foreground">
        Showing {startItem}-{endItem} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || isLoading}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || isLoading}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
