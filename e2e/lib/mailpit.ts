import { expect } from '@playwright/test'
import { getMailpitUrl } from '../env'

type MailpitSummary = { ID: string; Created: string; Subject: string }
type MailpitSearch = { messages: MailpitSummary[] }
type MailpitMessage = { HTML: string; Text: string }

/** Subjects of the emails the server sends (`apps/server/src/emails/index.tsx`). */
const SUBJECTS = {
  otp: 'DocGraph Verification Code',
  invitation: 'DocGraph Invitation',
}

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${getMailpitUrl()}${path}`)
  if (!response.ok) throw new Error(`Mailpit ${path} answered ${response.status}`)
  return (await response.json()) as T
}

/** Plain text of an email, without `<style>` blocks whose hex colors could pass for a code. */
const toPlainText = (message: MailpitMessage) =>
  message.Text ||
  message.HTML.replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')

/**
 * Waits for the newest email with `subject` sent to `email` after `since`. `since` keeps emails
 * from earlier runs or other tests out of the way.
 */
const waitForEmail = async (email: string, subject: string, since: Date) => {
  let messageId: string | undefined

  await expect
    .poll(
      async () => {
        const query = encodeURIComponent(`to:"${email}" subject:"${subject}"`)
        const { messages } = await getJson<MailpitSearch>(`/api/v1/search?query=${query}`)
        messageId = messages.find((message) => new Date(message.Created) >= since)?.ID
        return messageId
      },
      { message: `no "${subject}" email for ${email} in Mailpit`, timeout: 15_000 },
    )
    .toBeTruthy()

  return getJson<MailpitMessage>(`/api/v1/message/${messageId}`)
}

/** Waits for a verification email (login or password reset) and returns the one-time code. */
export const waitForOtpCode = async (email: string, since: Date) => {
  const message = await waitForEmail(email, SUBJECTS.otp, since)
  const code = toPlainText(message).match(/\b\d{6}\b/)?.[0]
  if (!code) throw new Error('The verification email carries no 6-digit code')
  return code
}

/** Waits for the invitation email and returns the login link in it. */
export const waitForInvitationLink = async (email: string, since: Date) => {
  const message = await waitForEmail(email, SUBJECTS.invitation, since)
  const href = message.HTML.match(/href="([^"]*\/login-otp[^"]*)"/)?.[1]
  if (!href) throw new Error('The invitation email carries no login link')
  return href.replace(/&amp;/g, '&')
}
