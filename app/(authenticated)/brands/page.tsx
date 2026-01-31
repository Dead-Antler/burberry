"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { BrandsTable } from "@/app/components/brands/brands-table"
import { BrandDialog } from "@/app/components/brands/brand-dialog"
import { DeleteBrandDialog } from "@/app/components/brands/delete-brand-dialog"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { Brand } from "@/app/lib/api-types"

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [deletingBrand, setDeletingBrand] = useState<Brand | null>(null)

  const fetchBrands = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.getBrands()
      setBrands(data)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load brands"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  const handleCreateSuccess = (brand: Brand) => {
    setBrands((prev) => [...prev, brand])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updatedBrand: Brand) => {
    setBrands((prev) =>
      prev.map((b) => (b.id === updatedBrand.id ? updatedBrand : b))
    )
    setEditingBrand(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setBrands((prev) => prev.filter((b) => b.id !== deletedId))
    setDeletingBrand(null)
  }

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Brands" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
            <p className="text-muted-foreground">
              Manage wrestling brands and promotions.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Brand
          </Button>
        </div>

        <BrandsTable
          brands={brands}
          isLoading={isLoading}
          error={error}
          onEdit={setEditingBrand}
          onDelete={setDeletingBrand}
          onRetry={fetchBrands}
        />

        <BrandDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={handleCreateSuccess}
        />

        <BrandDialog
          open={editingBrand !== null}
          onOpenChange={(open) => !open && setEditingBrand(null)}
          brand={editingBrand}
          onSuccess={handleEditSuccess}
        />

        <DeleteBrandDialog
          open={deletingBrand !== null}
          onOpenChange={(open) => !open && setDeletingBrand(null)}
          brand={deletingBrand}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </>
  )
}
