import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { AppSidebar } from "@/app/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  const user = {
    name: session.user?.name ?? "",
    email: session.user?.email ?? "",
    isAdmin: session.user?.isAdmin ?? false,
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
