"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Search } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WrestlersTable } from "@/app/components/wrestlers/wrestlers-table"
import { WrestlerDialog } from "@/app/components/wrestlers/wrestler-dialog"
import { DeleteWrestlerDialog } from "@/app/components/wrestlers/delete-wrestler-dialog"
import { PaginationControls } from "@/app/components/pagination-controls"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Wrestler, Brand, PaginationInfo } from "@/app/lib/api-types"

export default function WrestlersPage() {
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null)
  const [deletingWrestler, setDeletingWrestler] = useState<Wrestler | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchData = useCallback(async (page = 1, search = "") => {
    setIsLoading(true)
    setError(null)
    try {
      const [wrestlersResult, brandsData] = await Promise.all([
        apiClient.getWrestlers({ page, search: search || undefined }),
        apiClient.getBrands(),
      ])
      setWrestlers(wrestlersResult.data)
      setPagination(wrestlersResult.pagination)
      setBrands(brandsData)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load data"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(currentPage, debouncedSearch)
  }, [fetchData, currentPage, debouncedSearch])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false)
    fetchData(currentPage, debouncedSearch)
  }

  const handleEditSuccess = () => {
    setEditingWrestler(null)
    fetchData(currentPage, debouncedSearch)
  }

  const handleDeleteSuccess = () => {
    setDeletingWrestler(null)
    // If we deleted the last item on this page, go to previous page
    if (wrestlers.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1)
    } else {
      fetchData(currentPage, debouncedSearch)
    }
  }

  // Create a memoized map for quick brand name lookup
  const brandMap = useMemo(
    () => new Map(brands.map((b) => [b.id, b.name])),
    [brands]
  )

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Wrestlers" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Wrestlers</h1>
            <p className="text-muted-foreground">
              Manage wrestlers and their brand affiliations.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Wrestler
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search wrestlers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <WrestlersTable
          wrestlers={wrestlers}
          brandMap={brandMap}
          isLoading={isLoading}
          error={error}
          onEdit={setEditingWrestler}
          onDelete={setDeletingWrestler}
          onRetry={() => fetchData(currentPage, debouncedSearch)}
        />

        {pagination && (
          <PaginationControls
            pagination={pagination}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}

        <WrestlerDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          brands={brands}
          onSuccess={handleCreateSuccess}
        />

        <WrestlerDialog
          open={editingWrestler !== null}
          onOpenChange={(open) => !open && setEditingWrestler(null)}
          wrestler={editingWrestler}
          brands={brands}
          onSuccess={handleEditSuccess}
        />

        <DeleteWrestlerDialog
          open={deletingWrestler !== null}
          onOpenChange={(open) => !open && setDeletingWrestler(null)}
          wrestler={deletingWrestler}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </>
  )
}
