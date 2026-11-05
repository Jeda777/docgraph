import { toast } from '@/components/ui/toast'
import { getErrorMessage } from '@/lib/api'

/**
 * Reports a failed action that has no form field to point at (e.g. an email that could not be
 * sent). `title` names the action, the description comes from `getErrorMessage`.
 */
export const showErrorToast = (title: string, error: unknown) =>
  toast.add({ type: 'error', title, description: getErrorMessage(error) })
