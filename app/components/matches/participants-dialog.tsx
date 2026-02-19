"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { SideColumn } from "./participant-card"
import { useParticipantManagement } from "./use-participant-management"
import type { MatchWithParticipants } from "@/app/lib/api-types"

interface ParticipantsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  match: MatchWithParticipants | null
  eventBrandId?: string
  onUpdate: () => void
}

export function ParticipantsDialog({
  open,
  onOpenChange,
  match,
  eventBrandId,
  onUpdate,
}: ParticipantsDialogProps) {
  const {
    participantsBySide,
    sideNumbers,
    maxSide,
    allOptions,
    isLoadingOptions,
    removingId,
    togglingChampionId,
    movingId,
    error,
    wrestlerGroupsMap,
    handleAddToSide,
    handleRemove,
    handleToggleChampion,
    handleMoveParticipant,
    handleAddSide,
  } = useParticipantManagement({ match, open, eventBrandId, onUpdate })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full max-w-none max-h-none sm:w-[80vw] sm:h-[80vh] sm:max-w-[80vw] sm:max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Participants</DialogTitle>
          <DialogDescription>
            {match?.matchType} — Match #{match?.matchOrder}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {isLoadingOptions ? (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Skeleton className="h-[200px] w-full sm:w-[calc(25%-0.75rem)]" />
              <Skeleton className="h-[200px] w-full sm:w-[calc(25%-0.75rem)]" />
            </div>
          ) : (
            <>
              {/* Side columns - stack on mobile, flex-wrap on desktop (max 4 per row) */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                {sideNumbers.map((sideNum) => (
                  <SideColumn
                    key={sideNum}
                    sideNumber={sideNum}
                    participants={participantsBySide.get(sideNum) ?? []}
                    allOptions={allOptions}
                    onAddParticipant={handleAddToSide}
                    onRemoveParticipant={handleRemove}
                    onToggleChampion={handleToggleChampion}
                    onMoveParticipant={handleMoveParticipant}
                    allSides={sideNumbers}
                    removingId={removingId}
                    togglingChampionId={togglingChampionId}
                    movingId={movingId}
                    wrestlerGroupsMap={wrestlerGroupsMap}
                  />
                ))}

                {/* Add Side button */}
                <Card className="w-full sm:flex-1 sm:min-w-50 border-dashed">
                  <CardContent className="flex flex-col items-center justify-center h-full py-6">
                    <Button
                      variant="ghost"
                      className="flex flex-col gap-2 h-auto py-3"
                      onClick={handleAddSide}
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-sm">Add Side {maxSide + 1}</span>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
