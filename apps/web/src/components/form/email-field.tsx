import type { FieldValues } from 'react-hook-form'
import { FormInput, type FormInputProps } from './form-input'

export const EmailField = <T extends FieldValues>(props: FormInputProps<T>) => (
  <FormInput type='email' label='Email' autoComplete='email' spellCheck={false} {...props} />
)
