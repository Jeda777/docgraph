import { z } from 'zod'

export const OTP_CODE_LENGTH = 6

const OTP_CODE_MESSAGE = `Enter the ${OTP_CODE_LENGTH}-digit code sent to your email`

export const otpCodeSchema = z
  .string({ error: OTP_CODE_MESSAGE })
  .length(OTP_CODE_LENGTH, OTP_CODE_MESSAGE)
