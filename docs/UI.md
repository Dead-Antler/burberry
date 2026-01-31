# UI Guidelines

Patterns and conventions for building consistent, accessible UI views.

## Component Library

Use **shadcn/ui** components. Install new components as needed:

```bash
bunx shadcn@latest add <component-name>
```

Common components: `button`, `input`, `label`, `card`, `table`, `dialog`, `alert-dialog`, `dropdown-menu`, `skeleton`

## Page Structure

All authenticated pages follow this structure:

```tsx
export default function EntityPage() {
  return (
    <>
      <SiteHeader breadcrumbs={[
        { label: "Admin", href: "/admin" },
        { label: "Entity Name" }
      ]} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Page header with title and actions */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Entity Name</h1>
            <p className="text-muted-foreground">Description of this page.</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Entity
          </Button>
        </div>

        {/* Main content */}
        <EntityTable ... />
      </div>
    </>
  )
}
```

### Breadcrumbs

- Use `SiteHeader` with `breadcrumbs` prop
- Last item has no `href` (current page)
- Admin pages: `[{ label: "Admin", href: "/admin" }, { label: "Page Name" }]`

## Data Tables

### Card + Table Pattern

Wrap tables in a Card with no padding:

```tsx
<Card className="py-0 overflow-hidden">
  <CardContent className="p-0">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="hidden sm:table-cell">Created</TableHead>
          <TableHead className="hidden md:table-cell">Updated</TableHead>
          <TableHead className="w-[70px]">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell className="hidden sm:table-cell text-muted-foreground">
              {formatDate(item.createdAt)}
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {formatDate(item.updatedAt)}
            </TableCell>
            <TableCell>
              <ActionsDropdown item={item} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

### Responsive Columns

Hide less important columns on smaller screens:

| Breakpoint | Class | Visible |
|------------|-------|---------|
| Always | (none) | Primary column (name) |
| sm (640px+) | `hidden sm:table-cell` | Secondary info |
| md (768px+) | `hidden md:table-cell` | Tertiary info |
| lg (1024px+) | `hidden lg:table-cell` | Optional details |

### Row Actions

Use DropdownMenu for row actions:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}>
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => onEdit(item)}>
      <Pencil className="mr-2 h-4 w-4" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem
      onClick={() => onDelete(item)}
      className="text-destructive focus:text-destructive"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Dialogs

### Create/Edit Dialog

Use a single Dialog component for both create and edit:

```tsx
interface EntityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity?: Entity | null  // null/undefined = create mode
  onSuccess: (entity: Entity) => void
}

export function EntityDialog({ open, onOpenChange, entity, onSuccess }: EntityDialogProps) {
  const isEditing = entity !== null && entity !== undefined
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(entity?.name ?? "")
      setError(null)
    }
  }, [open, entity])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validation, API call, error handling...
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Entity" : "Create Entity"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update the entity details." : "Enter details for the new entity."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### Delete Confirmation

Use AlertDialog for destructive actions:

```tsx
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Entity</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to delete "{entity?.name}"? This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
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
```

## State Management

### Page-Level State

Use client components with useState for managing:

```tsx
"use client"

export default function EntityPage() {
  // Data state
  const [entities, setEntities] = useState<Entity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [deletingEntity, setDeletingEntity] = useState<Entity | null>(null)

  // Fetch data on mount
  const fetchEntities = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiClient.getEntities()
      setEntities(data)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntities()
  }, [fetchEntities])

  // Optimistic updates after mutations
  const handleCreateSuccess = (entity: Entity) => {
    setEntities((prev) => [...prev, entity])
    setIsCreateDialogOpen(false)
  }

  const handleEditSuccess = (updated: Entity) => {
    setEntities((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    setEditingEntity(null)
  }

  const handleDeleteSuccess = (deletedId: string) => {
    setEntities((prev) => prev.filter((e) => e.id !== deletedId))
    setDeletingEntity(null)
  }
}
```

### API Client Usage

Always use the typed `apiClient` from `@/app/lib/api-client`:

```tsx
import { apiClient, ApiClientError } from "@/app/lib/api-client"

try {
  const result = await apiClient.createEntity({ name: "Test" })
} catch (err) {
  const message = err instanceof ApiClientError ? err.message : "Something went wrong"
}
```

## Loading & Error States

### Loading Skeleton

Match the table structure with Skeleton placeholders:

```tsx
function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {/* ... same headers as real table ... */}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
            {/* ... */}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Error State

Show error message with retry button:

```tsx
if (error) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={onRetry}>Try Again</Button>
      </CardContent>
    </Card>
  )
}
```

### Empty State

Helpful message when no data exists:

```tsx
if (entities.length === 0) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-10">
        <p className="text-sm text-muted-foreground">
          No entities found. Create your first entity to get started.
        </p>
      </CardContent>
    </Card>
  )
}
```

## Accessibility

### Required Practices

1. **Labels**: Always associate labels with form inputs using `htmlFor`/`id`
2. **ARIA labels**: Add `aria-label` to icon-only buttons
3. **Error announcements**: Use `role="alert"` on error messages
4. **Screen reader text**: Use `sr-only` class for visually hidden labels
5. **Focus management**: Dialog components handle focus automatically

### Example

```tsx
{/* Icon button with aria-label */}
<Button variant="ghost" size="icon" aria-label={`Actions for ${item.name}`}>
  <MoreHorizontal className="h-4 w-4" />
</Button>

{/* Visually hidden table header */}
<TableHead className="w-[70px]">
  <span className="sr-only">Actions</span>
</TableHead>

{/* Error with role="alert" */}
{error && <p className="text-sm text-destructive" role="alert">{error}</p>}
```

## Spacing Conventions

| Use Case | Class |
|----------|-------|
| Label + Input pairs | `space-y-2` |
| Form sections | `space-y-4` or `grid gap-4` |
| Page sections | `gap-4` |
| Page padding | `p-4` |
| Card content padding | `px-6` (default), `p-0` for tables |
| Centered empty/error states | `py-10` |

## File Organization

```
app/
  components/
    {entity}/
      {entity}-table.tsx       # Table with loading/error/empty states
      {entity}-dialog.tsx      # Create/edit dialog
      delete-{entity}-dialog.tsx  # Delete confirmation
  (authenticated)/
    {entity}/
      page.tsx                 # Page component with state management
```

## Checklist for New Views

- [ ] Page uses `SiteHeader` with appropriate breadcrumbs
- [ ] Page header has title, description, and primary action button
- [ ] Table wrapped in `Card` with `py-0 overflow-hidden`
- [ ] Responsive column hiding with `hidden sm:table-cell` pattern
- [ ] Row actions use `DropdownMenu` with edit/delete options
- [ ] Delete action styled with `text-destructive`
- [ ] Create/edit uses single `Dialog` component with mode detection
- [ ] Delete uses `AlertDialog` with destructive button styling
- [ ] Loading state shows skeleton matching table structure
- [ ] Error state shows message with retry button
- [ ] Empty state shows helpful message
- [ ] All icon buttons have `aria-label`
- [ ] Error messages have `role="alert"`
- [ ] Form inputs have associated labels
