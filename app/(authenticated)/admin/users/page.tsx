"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "@/app/lib/auth-client"
import { Plus } from "lucide-react"
import { SiteHeader } from "@/app/components/site-header"
import { Button } from "@/components/ui/button"
import { UsersTable } from "@/app/components/users/users-table"
import { UserDialog } from "@/app/components/users/user-dialog"
import { DeleteUserDialog } from "@/app/components/users/delete-user-dialog"
import { apiClient, ApiClientError } from "@/app/lib/api-client"
import type { User } from "@/app/lib/api-types"

export default function UsersPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)

  const currentUserId = session?.user?.id ?? ""

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiClient.getUsers()
      setUsers(response.data)
    } catch (err) {
      const message = err instanceof ApiClientError
        ? err.message
        : "Failed to load users"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreateSuccess = (user: User) => {
    setUsers((prev) => [...prev, user])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    )
    setEditingUser(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== deletedId))
    setDeletingUser(null)
  }

  return (
    <>
      <SiteHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Users" },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">
              Manage user accounts and permissions.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <UsersTable
          users={users}
          currentUserId={currentUserId}
          isLoading={isLoading}
          error={error}
          onEdit={setEditingUser}
          onDelete={setDeletingUser}
          onRetry={fetchUsers}
        />

        <UserDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          currentUserId={currentUserId}
          onSuccess={handleCreateSuccess}
        />

        <UserDialog
          open={editingUser !== null}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          currentUserId={currentUserId}
          onSuccess={handleEditSuccess}
        />

        <DeleteUserDialog
          open={deletingUser !== null}
          onOpenChange={(open) => !open && setDeletingUser(null)}
          user={deletingUser}
          onSuccess={handleDeleteSuccess}
        />
      </div>
    </>
  )
}
