import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

export default function EventNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Event not found</h1>
        <p className="text-muted-foreground">
          This event doesn&apos;t exist or has been removed.
        </p>
      </div>
      <Button asChild>
        <Link href="/events">Back to Events</Link>
      </Button>
    </div>
  )
}
