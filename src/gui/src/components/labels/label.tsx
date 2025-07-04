import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox.tsx'
import { Button } from '@/components/ui/button.tsx'
import { LabelBadge } from '@/components/labels/label-badge.tsx'
import { ArrowUpRight, Palette } from 'lucide-react'
import { Label as FormLabel } from '@/components/ui/label.tsx'
import { Input } from '@/components/ui/input.tsx'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover.tsx'
import {
  ColorPicker,
  DEFAULT_COLOR,
} from '@/components/ui/color-picker.tsx'
import type { Color, QueryLabel } from '@/state/types.ts'
import { useGraphStore } from '@/state/index.ts'
import { useToast } from '@/components/hooks/use-toast.ts'

interface LabelProps {
  queryLabel: QueryLabel
  checked: boolean
  handleSelect: (label: QueryLabel) => void
}

const Label = ({ queryLabel, checked, handleSelect }: LabelProps) => {
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [editDescription, setEditDescription] = useState<string>('')
  const [editName, setEditName] = useState<string>('')
  const [editColor, setEditColor] = useState<Color>(DEFAULT_COLOR)
  const updateSavedLabel = useGraphStore(
    state => state.updateSavedQueryLabel,
  )
  const { toast } = useToast()
  const [queriesReferenced, setQueriesReferenced] =
    useState<number>(0)
  const savedQueries = useGraphStore(state => state.savedQueries)

  const handleEdit = () => {
    setIsExpanded(!isExpanded)
  }

  const handleSaveChanges = () => {
    const updatedItem: QueryLabel = {
      ...queryLabel,
      name: editName,
      description: editDescription,
      color: editColor,
    }
    updateSavedLabel(updatedItem)
    setIsExpanded(false)
    toast({
      title: `${editName} saved successfully`,
    })
  }

  const navigateToRef = () => {
    void navigate(`/queries?label=${encodeURIComponent(editName)}`)
  }

  useEffect(() => {
    setQueriesReferenced(0)

    const count = savedQueries?.reduce((acc, query) => {
      return (
        acc +
        (query.labels?.filter(label => label.name === queryLabel.name)
          .length || 0)
      )
    }, 0)

    setQueriesReferenced(count || 0)
  }, [queryLabel, savedQueries])

  useEffect(() => {
    setEditName(queryLabel.name)
    setEditDescription(queryLabel.description)
    setEditColor(queryLabel.color)
  }, [queryLabel])

  return (
    <div
      className={`group rounded-sm border border-[1px] bg-card transition-colors transition-opacity hover:bg-card-accent ${isExpanded ? 'border-muted-foreground' : 'border-muted'}`}>
      <div className="flex grid grid-cols-8 items-center px-3 py-2">
        <div className="col-span-2 flex items-center gap-3">
          <Checkbox
            onCheckedChange={() => handleSelect(queryLabel)}
            checked={checked}
            className={`border-muted-foreground/25 opacity-0 group-hover:border-muted-foreground/50 group-hover:opacity-100 ${checked ? 'opacity-100' : 'opacity-0'}`}
          />
          <LabelBadge
            name={editName.trim() !== '' ? editName : 'Label preview'}
            color={editColor}
          />
        </div>
        <div className="col-span-4 flex items-center">
          {!isExpanded && (
            <p className="truncate text-sm">{editDescription}</p>
          )}
        </div>
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            className="flex items-center justify-center gap-1"
            onClick={() =>
              queriesReferenced ? navigateToRef() : undefined
            }>
            <span>{queriesReferenced}</span>
            <ArrowUpRight />
          </Button>
        </div>
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            className="h-[2rem] rounded-sm border border-[1px] border-muted-foreground/25 px-3 text-sm"
            onClick={handleEdit}>
            {isExpanded ? 'Close' : 'Edit'}
          </Button>
        </div>
      </div>

      {/* expanded */}
      {isExpanded && (
        <div className="mb-3 flex flex-col border-t-[1px] border-muted-foreground/25 px-3 py-2 pt-6">
          <div className="flex gap-3">
            <div className="flex flex-col gap-2">
              <FormLabel className="border-none text-sm font-medium">
                Name
              </FormLabel>
              <Input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="flex grow flex-col gap-2">
              <FormLabel className="border-none text-sm font-medium">
                Description
              </FormLabel>
              <Input
                type="text"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Description (optional)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <FormLabel className="border-none text-sm font-medium">
                Color
              </FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    className="w-[120px] font-normal"
                    variant="outline">
                    <Palette />
                    <span>{editColor}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <ColorPicker
                    defaultInput={editColor}
                    defaultColor={editColor}
                    onChange={setEditColor}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="mb-0.5 flex items-end">
              <Button
                disabled={
                  editName.trim() === '' ||
                  editName === 'Label preview'
                }
                onClick={handleSaveChanges}
                variant="default"
                size="sm">
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { Label }
