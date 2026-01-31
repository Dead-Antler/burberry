import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AppSidebar } from "@/app/components/app-sidebar"
import { ErrorBoundary } from "@/app/components/error-boundary"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserFromSession } from "@/app/lib/session-utils"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const user = getUserFromSession(session)

  if (!user) {
    redirect("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <ErrorBoundary>{children}</ErrorBoundary>
      </SidebarInset>
    </SidebarProvider>
  )
}
