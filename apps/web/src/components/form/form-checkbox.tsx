import type { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import {
  Controller,
  type FieldValues,
  type Path,
  useFormContext,
  useFormState,
} from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Checkbox } from '../ui/checkbox'

export type FormCheckboxProps<T extends FieldValues> = {
  name: Path<T>
  label: string
} & CheckboxPrimitive.Root.Props

export const FormCheckbox = <T extends FieldValues>({
  name,
  label,
  ...props
}: FormCheckboxProps<T>) => {
  const { control, getFieldState } = useFormContext<T>()
  const { error } = getFieldState(name, useFormState({ control, name }))

  return (
    <Field orientation='horizontal'>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <Checkbox
            id={name}
            checked={value}
            onCheckedChange={onChange}
            aria-invalid={!!error}
            {...props}
          />
        )}
      />
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <FieldError>{error?.message?.toString()}</FieldError>
    </Field>
  )
}
