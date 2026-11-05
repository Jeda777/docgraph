import type { FieldValues } from 'react-hook-form'
import { FormInput, type FormInputProps } from './form-input'

export const PasswordField = <T extends FieldValues>(props: FormInputProps<T>) => (
  <FormInput label='Password' type='password' autoComplete='current-password' {...props} />
)
