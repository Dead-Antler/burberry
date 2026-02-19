import { Skeleton } from "@/components/ui/skeleton"

export default function EventLoading() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Event title + status */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-6 w-20" />
        </div>
        {/* Event details */}
        <div className="flex gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        {/* Tabs */}
        <Skeleton className="h-10 w-80" />
        {/* Match cards */}
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}
