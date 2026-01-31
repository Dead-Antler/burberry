"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { WrestlersTable } from "@/app/components/wrestlers/wrestlers-table"
import { WrestlerDialog } from "@/app/components/wrestlers/wrestler-dialog"
import { DeleteWrestlerDialog } from "@/app/components/wrestlers/delete-wrestler-dialog"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Wrestler, Brand } from "@/app/lib/api-types"

export default function WrestlersPage() {
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null)
  const [deletingWrestler, setDeletingWrestler] = useState<Wrestler | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [wrestlersData, brandsData] = await Promise.all([
        apiClient.getWrestlers(),
        apiClient.getBrands(),
      ])
      setWrestlers(wrestlersData)
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
    fetchData()
  }, [fetchData])

  const handleCreateSuccess = (wrestler: Wrestler) => {
    setWrestlers((prev) => [...prev, wrestler])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updatedWrestler: Wrestler) => {
    setWrestlers((prev) =>
      prev.map((w) => (w.id === updatedWrestler.id ? updatedWrestler : w))
    )
    setEditingWrestler(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setWrestlers((prev) => prev.filter((w) => w.id !== deletedId))
    setDeletingWrestler(null)
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

        <WrestlersTable
          wrestlers={wrestlers}
          brandMap={brandMap}
          isLoading={isLoading}
          error={error}
          onEdit={setEditingWrestler}
          onDelete={setDeletingWrestler}
          onRetry={fetchData}
        />

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
