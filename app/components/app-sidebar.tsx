"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Swords } from "lucide-react"

import { NavUser } from "@/app/components/nav-user"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { getNavItems } from "@/app/lib/navigation"
import type { NavItem } from "@/app/lib/navigation"
import type { AppUser } from "@/app/lib/session-utils"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  user: AppUser
}

function NavItemWithChildren({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const isActive = pathname === item.url ||
    item.children?.some((child) => pathname === child.url || pathname.startsWith(child.url + "/"))

  return (
    <Collapsible asChild defaultOpen className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={isActive}>
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children?.map((child) => (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton asChild isActive={pathname === child.url}>
                  <Link href={child.url}>
                    <span>{child.title}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

function NavItemSimple({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
        tooltip={item.title}
      >
        <Link href={item.url}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const { main, admin } = getNavItems(user.isAdmin)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Swords className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Wrestling Predictions</span>
                  <span className="text-xs text-muted-foreground">
                    Predict. Compete. Win.
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) =>
                item.children ? (
                  <NavItemWithChildren
                    key={item.title}
                    item={item}
                    pathname={pathname}
                  />
                ) : (
                  <NavItemSimple key={item.title} item={item} pathname={pathname} />
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {admin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {admin.map((item) =>
                  item.children ? (
                    <NavItemWithChildren
                      key={item.title}
                      item={item}
                      pathname={pathname}
                    />
                  ) : (
                    <NavItemSimple key={item.title} item={item} pathname={pathname} />
                  )
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
