import Link from "next/link"
import { auth } from "@/auth"
import { AppSidebar } from "@/app/components/app-sidebar"
import { SiteHeader } from "@/app/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

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
  const session = await auth()

  // If authenticated, show within the app shell
  if (session) {
    const user = {
      name: session.user?.name ?? "",
      email: session.user?.email ?? "",
      isAdmin: session.user?.isAdmin ?? false,
    }

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
