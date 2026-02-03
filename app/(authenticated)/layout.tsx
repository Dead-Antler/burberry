import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/app/lib/auth"
import { AppSidebar } from "@/app/components/app-sidebar"
import { ErrorBoundary } from "@/app/components/error-boundary"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { getUserFromSession } from "@/app/lib/session-utils"
import type { AuthSession } from "@/app/lib/api-helpers"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
  }) as AuthSession | null

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
