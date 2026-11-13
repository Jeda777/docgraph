import type { ApiKeyProjectScope } from '@docgraph/common/schemas'
import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useProjectGetById } from '@/lib/api'

export type ApiKeyProjectScopeFieldProps = {
  project: { id: string; name: string }
  /** `undefined` — the project is not selected. */
  scope: ApiKeyProjectScope | undefined
  onChange: (scope: ApiKeyProjectScope | undefined) => void
  itemsError?: string
}

/** A project in an API key's access: off, the whole project, or only some of its items. */
export const ApiKeyProjectScopeField = ({
  project,
  scope,
  onChange,
  itemsError,
}: ApiKeyProjectScopeFieldProps) => {
  const id = useId()
  const itemIds = scope?.itemIds
  const { data: details } = useProjectGetById(project.id, { getItems: true }, Boolean(itemIds))

  const toggleItem = (itemId: string, checked: boolean) => {
    const selected = itemIds ?? []
    onChange({
      projectId: project.id,
      itemIds: checked ? [...selected, itemId] : selected.filter((id) => id !== itemId),
    })
  }

  return (
    <li className='flex flex-col gap-2 px-3 py-2'>
      <Field orientation='horizontal'>
        <Checkbox
          id={`${id}-project`}
          checked={Boolean(scope)}
          onCheckedChange={(checked) => onChange(checked ? { projectId: project.id } : undefined)}
        />
        <FieldLabel htmlFor={`${id}-project`} className='min-w-0 truncate'>
          {project.name}
        </FieldLabel>
      </Field>

      {scope && (
        <div className='flex flex-col gap-2 pl-6'>
          <RadioGroup
            aria-label={`Access to ${project.name}`}
            value={itemIds ? 'items' : 'project'}
            onValueChange={(value) =>
              onChange(
                value === 'items'
                  ? { projectId: project.id, itemIds: [] }
                  : { projectId: project.id },
              )
            }
          >
            <Field orientation='horizontal'>
              <RadioGroupItem id={`${id}-whole`} value='project' />
              <FieldLabel htmlFor={`${id}-whole`}>Whole project</FieldLabel>
            </Field>
            <Field orientation='horizontal'>
              <RadioGroupItem id={`${id}-items`} value='items' />
              <FieldLabel htmlFor={`${id}-items`}>Selected items</FieldLabel>
            </Field>
          </RadioGroup>

          {itemIds && (
            <ul className='flex flex-col gap-1.5'>
              {details?.items?.length === 0 && (
                <li className='text-xs text-muted-foreground'>This project has no items.</li>
              )}
              {details?.items?.map((item) => (
                <li key={item.id}>
                  <Field orientation='horizontal'>
                    <Checkbox
                      id={`${id}-item-${item.id}`}
                      checked={itemIds.includes(item.id)}
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
          <FieldError>{itemsError}</FieldError>
        </div>
      )}
    </li>
  )
}
