"use client"

import { cn } from "@/lib/utils"
import { groupNameToColor } from "@/app/lib/color-utils"

interface GroupBadgeProps {
  groupName: string
  size?: "sm" | "md"
  className?: string
}

/**
 * Colored badge for displaying group membership.
 * Color is deterministically generated from the group name.
 * Text color is calculated for WCAG AA contrast compliance.
 */
export function GroupBadge({ groupName, size = "sm", className }: GroupBadgeProps) {
  const { bg, text } = groupNameToColor(groupName)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
      style={{ backgroundColor: bg, color: text }}
    >
      {groupName}
    </span>
  )
}
