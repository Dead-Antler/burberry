"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, Search } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GroupsTable } from "@/app/components/groups/groups-table"
import { GroupDialog } from "@/app/components/groups/group-dialog"
import { DeleteGroupDialog } from "@/app/components/groups/delete-group-dialog"
import { GroupMembersDialog } from "@/app/components/groups/group-members-dialog"
import { PaginationControls } from "@/app/components/pagination-controls"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Group, GroupWithMembers, GroupMemberWithWrestler, Brand, Wrestler, PaginationInfo } from "@/app/lib/api-types"

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithMembers[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<GroupWithMembers | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<GroupWithMembers | null>(null)
  const [managingMembersGroup, setManagingMembersGroup] = useState<GroupWithMembers | null>(null)

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
      const [groupsResult, brandsData, wrestlersData] = await Promise.all([
        apiClient.getGroups({ includeMembers: true, page, search: search || undefined }),
        apiClient.getBrands(),
        apiClient.getAllWrestlers(),
      ])
      setGroups(groupsResult.data as GroupWithMembers[])
      setPagination(groupsResult.pagination)
      setBrands(brandsData)
      setWrestlers(wrestlersData)
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
    setEditingGroup(null)
    fetchData(currentPage, debouncedSearch)
  }

  const handleDeleteSuccess = () => {
    setDeletingGroup(null)
    if (groups.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1)
    } else {
      fetchData(currentPage, debouncedSearch)
    }
  }

  const handleMembersChange = () => {
    fetchData(currentPage, debouncedSearch)
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
          { label: "Groups" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
            <p className="text-muted-foreground">
              Manage tag teams and stables.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <GroupsTable
          groups={groups}
          brandMap={brandMap}
          isLoading={isLoading}
          error={error}
          onEdit={setEditingGroup}
          onDelete={setDeletingGroup}
          onManageMembers={setManagingMembersGroup}
          onRetry={() => fetchData(currentPage, debouncedSearch)}
        />

        {pagination && (
          <PaginationControls
            pagination={pagination}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}

        <GroupDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          brands={brands}
          onSuccess={handleCreateSuccess}
        />

        <GroupDialog
          open={editingGroup !== null}
          onOpenChange={(open) => !open && setEditingGroup(null)}
          group={editingGroup}
          brands={brands}
          onSuccess={handleEditSuccess}
        />

        <DeleteGroupDialog
          open={deletingGroup !== null}
          onOpenChange={(open) => !open && setDeletingGroup(null)}
          group={deletingGroup}
          onSuccess={handleDeleteSuccess}
        />

        <GroupMembersDialog
          open={managingMembersGroup !== null}
          onOpenChange={(open) => !open && setManagingMembersGroup(null)}
          group={managingMembersGroup}
          wrestlers={wrestlers}
          brandMap={brandMap}
          onMembersChange={handleMembersChange}
        />
      </div>
    </>
  )
}
