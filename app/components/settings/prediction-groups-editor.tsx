"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import { GroupDialog } from "./group-dialog"
import { GroupRow } from "./group-row"
import type { PredictionGroup } from "@/app/lib/api-types"

export function PredictionGroupsEditor() {
  const [groups, setGroups] = useState<PredictionGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<PredictionGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<PredictionGroup | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchGroups = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.getPredictionGroups()
      setGroups(data)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load groups")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleCreateSuccess = (group: PredictionGroup) => {
    setGroups((prev) => [...prev, group])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updated: PredictionGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
    setEditingGroup(null)
  }

  const handleDelete = async () => {
    if (!deletingGroup) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await apiClient.deletePredictionGroup(deletingGroup.id)
      setGroups((prev) => prev.filter((g) => g.id !== deletingGroup.id))
      setDeletingGroup(null)
    } catch (err) {
      setDeleteError(err instanceof ApiClientError ? err.message : "Failed to delete group")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Prediction Groups</CardTitle>
              <CardDescription>
                Create collections of templates to quickly apply to events.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Add Group
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={fetchGroups}>Try Again</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">
                No groups yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  onEdit={() => setEditingGroup(group)}
                  onDelete={() => setDeletingGroup(group)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <GroupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      <GroupDialog
        open={editingGroup !== null}
        onOpenChange={(open) => { if (!open) setEditingGroup(null) }}
        group={editingGroup}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Dialog */}
      <AlertDialog
        open={deletingGroup !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingGroup(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingGroup?.name}&rdquo;? This will not
              affect templates or existing event predictions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
