import { act, cleanup, render, screen } from '@testing-library/react'
import { FormProvider, type UseFormReturn, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'
import { FormInput } from './form-input'

afterEach(cleanup)

type Values = { name: string; owner: { email: string } }

let form: UseFormReturn<Values>

const TestForm = () => {
  form = useForm<Values>({ defaultValues: { name: '', owner: { email: '' } } })
  return (
    <FormProvider {...form}>
      <FormInput name='name' label='Name' />
      <FormInput name='owner.email' label='Owner email' />
    </FormProvider>
  )
}

describe('FormInput', () => {
  it('shows and clears an error on a top-level field', () => {
    render(<TestForm />)

    act(() => form.setError('name', { message: 'Name is required' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')

    act(() => form.clearErrors('name'))
    expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
  })

  it('shows an error on a nested field path', () => {
    render(<TestForm />)

    act(() => form.setError('owner.email', { message: 'Invalid email' }))
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
    expect(screen.getByLabelText('Owner email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false')
  })
})
