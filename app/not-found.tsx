import Link from "next/link"
import { headers } from "next/headers"
import { auth } from "@/app/lib/auth"
import { AppSidebar } from "@/app/components/app-sidebar"
import { SiteHeader } from "@/app/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"
import { getUserFromSession } from "@/app/lib/session-utils"
import type { AuthSession } from "@/app/lib/api-helpers"

function NotFoundContent() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to Dashboard</Link>
      </Button>
    </div>
  )
}

export default async function NotFound() {
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
  }) as AuthSession | null
  const user = getUserFromSession(session)

  // If authenticated, show within the app shell
  if (user) {
    return (
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
          <SiteHeader breadcrumbs={[{ label: "Not Found" }]} />
          <NotFoundContent />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  // If not authenticated, show simple centered layout
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <NotFoundContent />
    </div>
  )
}
