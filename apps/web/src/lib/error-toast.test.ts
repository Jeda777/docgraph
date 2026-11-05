import { describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from './api/test-utils'

const toast = vi.hoisted(() => ({ add: vi.fn() }))

vi.mock('@/components/ui/toast', () => ({ toast }))

const { showErrorToast } = await import('./error-toast')

describe('showErrorToast', () => {
  it('shows the action as the title and the text for the error code as the description', () => {
    showErrorToast(
      'Could not invite the user',
      apiAxiosError(500, 'EMAIL_DELIVERY_FAILED', 'Failed to send invite email'),
    )

    expect(toast.add).toHaveBeenCalledWith({
      type: 'error',
      title: 'Could not invite the user',
      description: "We couldn't send the email. Please try again later.",
    })
  })
})
