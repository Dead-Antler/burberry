import type { LucideIcon } from 'lucide-react'
import {
  Calendar,
  CalendarCog,
  Home,
  Settings,
  Trophy,
  Users,
  UserCog,
  Swords,
  Crown,
  Target,
} from 'lucide-react'

export interface NavSubItem {
  title: string
  url: string
}

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
  adminOnly?: boolean
  children?: NavSubItem[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/',
    icon: Home,
  },
  {
    title: 'Events',
    url: '/events',
    icon: Calendar,
  },
  {
    title: 'Predictions',
    url: '/predictions',
    icon: Target,
  },
  {
    title: 'Leaderboard',
    url: '/leaderboard',
    icon: Trophy,
  },
  {
    title: 'Manage Events',
    url: '/admin/events',
    icon: CalendarCog,
    adminOnly: true,
    children: [
      { title: 'Events', url: '/admin/events' },
      { title: 'Matches', url: '/admin/matches' },
    ],
  },
  {
    title: 'Wrestlers',
    url: '/wrestlers',
    icon: Swords,
    adminOnly: true,
  },
  {
    title: 'Groups',
    url: '/groups',
    icon: Users,
    adminOnly: true,
  },
  {
    title: 'Brands',
    url: '/brands',
    icon: Crown,
    adminOnly: true,
  },
  {
    title: 'Users',
    url: '/admin/users',
    icon: UserCog,
    adminOnly: true,
  },
  {
    title: 'Settings',
    url: '/admin/settings',
    icon: Settings,
    adminOnly: true,
  },
]

export function getNavItems(isAdmin: boolean): { main: NavItem[]; admin: NavItem[] } {
  const main = NAV_ITEMS.filter((item) => !item.adminOnly)
  const admin = isAdmin ? NAV_ITEMS.filter((item) => item.adminOnly) : []

  return { main, admin }
}
