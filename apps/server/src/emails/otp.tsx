import type { EmailOTPOptions } from 'better-auth/plugins'
import { Hr, Text } from 'react-email'
import { BaseTemplate } from './base-template'
import { LOGO_DATA_URI } from './logo'

export type OtpProps = {
  name: string
  otp: string
  type: Parameters<EmailOTPOptions['sendVerificationOTP']>['0']['type']
  validMinutes: number
  /** See `TopLogoProps.src`. */
  logoSrc?: string
}

export const Otp = ({ name, otp, type, validMinutes, logoSrc }: OtpProps) => {
  return (
    <BaseTemplate name={name} previewText='Your DocGraph verification code' logoSrc={logoSrc}>
      <Text className='text-neutral-600 mb-6 mt-0 text-base'>
        {type === 'sign-in'
          ? 'Use the following code to log in to your DocGraph account.'
          : 'Use the following code to reset your DocGraph password.'}
      </Text>
      <Text className='bg-neutral-100 text-neutral-900 text-center text-lg font-bold py-3 rounded-lg'>
        {otp}
      </Text>
      <Hr className='mt-8 mb-5' />
      <Text className='m-0 text-xs text-neutral-600'>
        This code expires in {validMinutes} minutes. If you were not expecting it, you can ignore
        this email.
      </Text>
    </BaseTemplate>
  )
}

Otp.PreviewProps = {
  name: 'John Doe',
  otp: '123456',
  type: 'sign-in',
  validMinutes: 3,
  logoSrc: LOGO_DATA_URI,
} as OtpProps

export default Otp
