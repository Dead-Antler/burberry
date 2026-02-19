"use client"

import { useState } from "react"
import { Lock, Unlock, Play, CheckCircle2, AlertTriangle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiClient } from "@/app/lib/api-client"
import type { Event, EventStatus } from "@/app/lib/api-types"

interface EventAdminControlsProps {
  event: Event
  onEventUpdate: (event: Event) => void
  onSurpriseMatch?: () => void
  matchCount: number
}

export function EventAdminControls({ event, onEventUpdate, onSurpriseMatch, matchCount }: EventAdminControlsProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
  } | null>(null)

  const handleStatusChange = async (newStatus: EventStatus) => {
    setIsUpdating(true)
    try {
      const updated = await apiClient.updateEvent(event.id, { status: newStatus })
      onEventUpdate(updated)

      // If marking as completed, automatically score the event
      if (newStatus === 'completed') {
        try {
          await apiClient.scoreEvent(event.id)
        } catch (scoreError) {
          console.error('Failed to score event:', scoreError)
          alert(`Event marked complete but scoring failed: ${scoreError instanceof Error ? scoreError.message : 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error(`Failed to update event status to ${newStatus}:`, error)
      alert(`Failed to update event status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsUpdating(false)
      setConfirmDialog(null)
    }
  }

  const getStatusActions = () => {
    const actions: React.ReactElement[] = []

    switch (event.status) {
      case 'pending':
        actions.push(
          <Button
            key="open"
            onClick={() => setConfirmDialog({
              open: true,
              title: 'Open Event for Predictions',
              description: 'Users will be able to join and make predictions. Are you sure?',
              action: () => handleStatusChange('open'),
            })}
            disabled={isUpdating}
            variant="default"
          >
            <Play className="h-4 w-4 mr-2" />
            Open Event
          </Button>
        )
        break

      case 'open':
        actions.push(
          <Button
            key="lock"
            onClick={() => setConfirmDialog({
              open: true,
              title: 'Lock Event',
              description: 'Predictions will be locked and you can start entering results. This cannot be undone. Are you sure?',
              action: () => handleStatusChange('locked'),
            })}
            disabled={isUpdating}
            variant="destructive"
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock Event
          </Button>
        )
        break

      case 'locked':
        if (onSurpriseMatch) {
          actions.push(
            <Button
              key="surprise"
              onClick={onSurpriseMatch}
              disabled={isUpdating}
              variant="outline"
            >
              <Zap className="h-4 w-4 mr-2" />
              Add Surprise Match
            </Button>
          )
        }
        actions.push(
          <Button
            key="complete"
            onClick={() => setConfirmDialog({
              open: true,
              title: 'Mark Event as Completed',
              description: 'This will finalize all scores and mark the event as completed. Are you sure?',
              action: () => handleStatusChange('completed'),
            })}
            disabled={isUpdating}
            variant="default"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>
        )
        break

      case 'completed':
        // No actions available for completed events
        break
    }

    return actions
  }

  const getStatusExplanation = () => {
    switch (event.status) {
      case 'pending':
        return 'Event is in pending state. Open it to allow users to join and make predictions.'
      case 'open':
        return 'Event is open. Users can join and make predictions. Lock it when the event starts.'
      case 'locked':
        return 'Event is locked. Predictions are frozen. Enter match results and then mark as complete.'
      case 'completed':
        return 'Event is completed. Scores have been finalized.'
      default:
        return ''
    }
  }

  const statusActions = getStatusActions()

  if (statusActions.length === 0 && event.status === 'completed') {
    return null // Don't show controls for completed events
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Admin Controls
          </CardTitle>
          <CardDescription>{getStatusExplanation()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {statusActions}
          </div>
        </CardContent>
      </Card>

      {confirmDialog && (
        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDialog.action()}>
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
