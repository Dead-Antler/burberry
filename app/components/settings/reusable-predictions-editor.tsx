"use client"

import { useState } from "react"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ReusablePredictionsEditorProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

export function ReusablePredictionsEditor({
  value,
  onChange,
  disabled = false,
}: ReusablePredictionsEditorProps) {
  const [newTemplate, setNewTemplate] = useState("")

  const handleAdd = () => {
    const trimmed = newTemplate.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
      setNewTemplate("")
    }
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleUpdate = (index: number, newValue: string) => {
    const updated = [...value]
    updated[index] = newValue
    onChange(updated)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reusable Prediction Templates</CardTitle>
        <CardDescription>
          Create templates for common custom predictions. Use these when setting up event predictions.
          <br />
          <span className="text-muted-foreground">
            Tip: Use {"<wrestler>"} as a placeholder for wrestler names.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing templates */}
        <div className="space-y-2">
          {value.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No templates yet. Add your first one below.
            </p>
          ) : (
            value.map((template, index) => (
              <div
                key={index}
                className="flex items-center gap-2 group"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                <Input
                  value={template}
                  onChange={(e) => handleUpdate(index, e.target.value)}
                  disabled={disabled}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Add new template */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Add new template..."
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleAdd}
            disabled={disabled || !newTemplate.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
