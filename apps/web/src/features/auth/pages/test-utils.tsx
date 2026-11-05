import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { Mock } from 'vitest'
import { expect } from 'vitest'

export const typeEmail = (email: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
}

export const typePassword = (password: string) => {
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
}

export const typeOtp = (code: string) => {
  fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: code } })
}

/** The primary submit button of the auth card (Log in / Reset). */
export const submitButton = (name: string) => screen.getByRole('button', { name })

/** Fills email and password, then waits until the form becomes valid. */
export const fillEmailAndPassword = async (email: string, password: string, submitName: string) => {
  typeEmail(email)
  typePassword(password)
  await waitFor(() => expect(submitButton(submitName)).toBeEnabled())
}

/**
 * Submits the only form on the page and waits for the async form validation to
 * reach the given mutation (pass `undefined` when a failed submission is expected).
 */
export const submitForm = async (mutation?: { mutate: Mock }) => {
  const form = document.querySelector('form')
  if (!form) throw new Error('No form rendered')
  fireEvent.submit(form)
  if (mutation) {
    await waitFor(() => expect(mutation.mutate).toHaveBeenCalled())
  }
}
