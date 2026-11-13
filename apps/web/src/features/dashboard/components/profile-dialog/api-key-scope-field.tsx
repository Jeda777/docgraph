import type { ApiKeyCreateInput, ApiKeyProjectScope } from '@docgraph/common/schemas'
import { useId } from 'react'
import { useController, useFormContext, useFormState } from 'react-hook-form'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useProjectGetList } from '@/lib/api'
import { ApiKeyProjectScopeField } from './api-key-project-scope-field'

const NAME = 'restrictions.projects'

/** Which projects an API key reaches: all the user's projects, or selected projects and items. */
export const ApiKeyScopeField = () => {
  const id = useId()
  const { control, getFieldState } = useFormContext<ApiKeyCreateInput>()
  const { field } = useController({ control, name: NAME })
  const formState = useFormState({ control, name: NAME })
  const { error } = getFieldState(NAME, formState)
  const selected = field.value
  const { data: projects = [] } = useProjectGetList(selected !== null)

  const setScope = (projectId: string, scope: ApiKeyProjectScope | undefined) => {
    const others = (selected ?? []).filter((entry) => entry.projectId !== projectId)
    field.onChange(scope ? [...others, scope] : others)
  }

  const itemsError = (projectId: string) => {
    const index = selected?.findIndex((entry) => entry.projectId === projectId) ?? -1
    if (index < 0) return undefined
    return getFieldState(`${NAME}.${index}.itemIds`, formState).error?.message
  }

  return (
    <FieldSet className='gap-2'>
      <FieldLegend variant='label'>Access</FieldLegend>
      <RadioGroup
        value={selected === null ? 'all' : 'selected'}
        onValueChange={(value) => field.onChange(value === 'all' ? null : [])}
      >
        <Field orientation='horizontal'>
          <RadioGroupItem id={`${id}-all`} value='all' />
          <FieldLabel htmlFor={`${id}-all`}>All my projects</FieldLabel>
        </Field>
        <Field orientation='horizontal'>
          <RadioGroupItem id={`${id}-selected`} value='selected' />
          <FieldLabel htmlFor={`${id}-selected`}>Selected projects and items</FieldLabel>
        </Field>
      </RadioGroup>

      {selected && (
        <>
          <FieldDescription>
            A checked project includes items added later. Expand a project to pick only some of its
            items; checking the project again selects all of them.
          </FieldDescription>
          <ul className='flex max-h-72 flex-col divide-y overflow-y-auto rounded-lg border'>
            {projects.map((project) => (
              <ApiKeyProjectScopeField
                key={project.id}
                project={project}
                scope={selected.find((entry) => entry.projectId === project.id)}
                onChange={(scope) => setScope(project.id, scope)}
                itemsError={itemsError(project.id)}
              />
            ))}
          </ul>
        </>
      )}
      <FieldError>{error?.message ?? error?.root?.message}</FieldError>
    </FieldSet>
  )
}
