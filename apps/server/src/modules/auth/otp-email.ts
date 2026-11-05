import { AsyncLocalStorage } from 'node:async_hooks'
import type { EmailOTPOptions } from 'better-auth/plugins'
import { renderOtp } from '../../emails'
import { log } from '../../logger'
import { mailer } from '../../mailer'
import { userRepository } from '../user/repo'

const logger = log('auth')

export const OTP_VALID_MINUTES = 3

type EmailDelivery = { failed: boolean }

/**
 * Better Auth swallows every error of `sendVerificationOTP` and answers 200, so a failed delivery
 * is recorded here instead and turned into `EMAIL_DELIVERY_FAILED` by the request handler.
 */
const emailDelivery = new AsyncLocalStorage<EmailDelivery>()

/** Runs `fn`, reporting whether an OTP email it tried to send failed. */
export const trackEmailDelivery = async <T>(fn: () => Promise<T>) => {
  const delivery: EmailDelivery = { failed: false }
  const result = await emailDelivery.run(delivery, fn)
  return { result, deliveryFailed: delivery.failed }
}

/**
 * `sendVerificationOTP` of Better Auth's email OTP plugin. With sign-up disabled Better Auth only
 * calls it for existing users and answers unknown addresses the same way, so none is revealed.
 */
export const sendOtpEmail = async ({
  email,
  otp,
  type,
}: Parameters<EmailOTPOptions['sendVerificationOTP']>['0']) => {
  const user = await userRepository.findByEmail(email)
  if (!user) return

  try {
    const mail = await renderOtp({ name: user.name, otp, type, validMinutes: OTP_VALID_MINUTES })
    await mailer.sendMail({ to: user.email, ...mail }, { logWithoutSmtp: `Code: ${otp}` })
  } catch (error) {
    logger.error('Failed to send OTP email: {error}', { error })
    const delivery = emailDelivery.getStore()
    if (delivery) delivery.failed = true
  }
}
