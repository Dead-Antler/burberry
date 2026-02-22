import { Suspense } from "react"
import { headers } from "next/headers"
import { cookies } from "next/headers"
import { auth } from "@/app/lib/auth"
import { SiteHeader } from "@/app/components/site-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, Target, Trophy, TrendingUp } from "lucide-react"
import type { DashboardStats } from "@/app/api/dashboard/stats/route"
import type { AuthSession } from "@/app/lib/api-helpers"

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function DashboardStatsCards() {
  // Need to get cookies to pass auth context
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const port = process.env.PORT || '3000'
  const res = await fetch(`http://localhost:${port}/api/dashboard/stats`, {
    headers: {
      Cookie: cookieHeader,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Unable to load stats. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const stats: DashboardStats = await res.json()

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Upcoming Events
          </CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.openEvents}</div>
          <p className="text-xs text-muted-foreground">
            Events open for predictions
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Your Predictions
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.userPredictions}</div>
          <p className="text-xs text-muted-foreground">
            Total predictions made
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Accuracy Rate
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.accuracy !== null ? `${stats.accuracy}%` : '--'}
          </div>
          <p className="text-xs text-muted-foreground">
            Overall prediction accuracy
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Leaderboard Rank
          </CardTitle>
          <Trophy className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.rank !== null ? `#${stats.rank}` : '--'}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.rank !== null ? `of ${stats.totalUsers} users` : 'Your current standing'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default async function DashboardPage() {
  const headersList = await headers()
  const session = await auth.api.getSession({
    headers: headersList,
  }) as AuthSession | null

  return (
    <>
      <SiteHeader breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session?.user?.name || "User"}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your predictions.
          </p>
        </div>

        <Suspense fallback={<StatsCardsSkeleton />}>
          <DashboardStatsCards />
        </Suspense>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Predictions</CardTitle>
              <CardDescription>
                Your latest prediction activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No predictions yet. Start by browsing upcoming events!
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Matches</CardTitle>
              <CardDescription>
                Matches you haven&apos;t predicted yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No upcoming matches at the moment.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
