import type { ApiKeyProjectScope } from '@docgraph/common/schemas'
import { ChevronRight } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { useProjectGetById } from '@/lib/api'
import { cn } from '@/lib/utils'

/**
 * The vendored checkbox only styles the checked state and always shows a check icon; for a partial
 * selection this hides the icon and draws a dash. Relies on Base UI's `data-indeterminate`.
 */
const INDETERMINATE_CLASSES =
  'data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-indeterminate:before:h-0.5 data-indeterminate:before:w-2 data-indeterminate:before:rounded-full data-indeterminate:before:bg-current [&[data-indeterminate]_svg]:hidden'

const describeScope = (scope: ApiKeyProjectScope | undefined) => {
  if (!scope) return undefined
  if (!scope.itemIds) return 'Whole project'
  return `${scope.itemIds.length} ${scope.itemIds.length === 1 ? 'item' : 'items'}`
}

export type ApiKeyProjectScopeFieldProps = {
  project: { id: string; name: string }
  /** `undefined` — the project is not selected. */
  scope: ApiKeyProjectScope | undefined
  onChange: (scope: ApiKeyProjectScope | undefined) => void
  itemsError?: string
}

/**
 * A project in an API key's access, as a tree: the project checkbox selects the whole project
 * (including items added later); checking only some of its items limits the key to them.
 */
export const ApiKeyProjectScopeField = ({
  project,
  scope,
  onChange,
  itemsError,
}: ApiKeyProjectScopeFieldProps) => {
  const id = useId()
  const [isExpanded, setExpanded] = useState(false)
  const { data: details } = useProjectGetById(project.id, { getItems: true }, isExpanded)
  const items = details?.items ?? []
  const isWholeProject = Boolean(scope && !scope.itemIds)

  const isItemSelected = (itemId: string) =>
    isWholeProject || Boolean(scope?.itemIds?.includes(itemId))

  const toggleItem = (itemId: string, checked: boolean) => {
    const selected = items.map((item) => item.id).filter(isItemSelected)
    const itemIds = checked ? [...selected, itemId] : selected.filter((id) => id !== itemId)
    onChange(itemIds.length > 0 ? { projectId: project.id, itemIds } : undefined)
  }

  return (
    <li className='flex flex-col py-1'>
      <div className='flex items-center gap-1 pr-3 pl-1'>
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          aria-label={`${isExpanded ? 'Hide' : 'Show'} items of ${project.name}`}
          aria-expanded={isExpanded}
          onClick={() => setExpanded(!isExpanded)}
        >
          <ChevronRight className={cn('transition-transform', isExpanded && 'rotate-90')} />
        </Button>
        <Field orientation='horizontal' className='min-w-0 flex-1'>
          <Checkbox
            id={`${id}-project`}
            checked={isWholeProject}
            indeterminate={Boolean(scope?.itemIds)}
            onCheckedChange={(checked) => onChange(checked ? { projectId: project.id } : undefined)}
            className={INDETERMINATE_CLASSES}
          />
          <FieldLabel htmlFor={`${id}-project`} className='min-w-0 truncate'>
            {project.name}
          </FieldLabel>
        </Field>
        <span className='shrink-0 text-xs text-muted-foreground'>{describeScope(scope)}</span>
      </div>

      {isExpanded && (
        <ul className='flex flex-col gap-1.5 py-1.5 pr-3 pl-13'>
          {!details && <li className='text-xs text-muted-foreground'>Loading items…</li>}
          {details?.items?.length === 0 && (
            <li className='text-xs text-muted-foreground'>This project has no items.</li>
          )}
          {items.map((item) => (
            <li key={item.id}>
              <Field orientation='horizontal'>
                <Checkbox
                  id={`${id}-item-${item.id}`}
                  checked={isItemSelected(item.id)}
                  onCheckedChange={(checked) => toggleItem(item.id, checked)}
                />
                <FieldLabel htmlFor={`${id}-item-${item.id}`} className='min-w-0 truncate'>
                  {item.name}
                </FieldLabel>
              </Field>
            </li>
          ))}
        </ul>
      )}
      <FieldError className='pr-3 pl-13'>{itemsError}</FieldError>
    </li>
  )
}
