import { type FieldValues, type Path, useFormContext, useFormState } from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type FormInputProps<T extends FieldValues> = {
  name: Path<T>
  label?: string
  size?: 'sm' | 'md'
} & Omit<React.ComponentPropsWithoutRef<'input'>, 'size'>

export const FormInput = <T extends FieldValues>({
  name,
  label,
  size = 'md',
  ...props
}: FormInputProps<T>) => {
  const { register, control, getFieldState } = useFormContext<T>()
  // `useFormState` returns a new object on every change, so React Compiler sees fresh errors;
  // `getFieldState` also resolves nested paths such as `items.0.name`.
  const { error } = getFieldState(name, useFormState({ control, name }))

  return (
    <Field>
      {label && (
        <FieldLabel htmlFor={name} className={cn(size === 'sm' && 'text-xs')}>
          {label}
        </FieldLabel>
      )}
      <Input
        id={name}
        {...register(name)}
        aria-invalid={!!error}
        className={cn(size === 'sm' && 'text-xs')}
        {...props}
      />
      <FieldError>{error?.message?.toString()}</FieldError>
    </Field>
  )
}
