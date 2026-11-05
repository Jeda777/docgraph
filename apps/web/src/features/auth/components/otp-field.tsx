import { OTP_CODE_LENGTH } from '@docgraph/common/schemas'
import { useEffect, useState } from 'react'
import {
  Controller,
  type FieldValues,
  type Path,
  useFormContext,
  useFormState,
} from 'react-hook-form'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'

export type OtpFieldProps<T extends FieldValues> = {
  name: Path<T>
  onResend: () => void
  firstAttempt: boolean
}

export const OtpField = <T extends FieldValues>({
  name,
  onResend,
  firstAttempt,
}: OtpFieldProps<T>) => {
  const { control, getFieldState } = useFormContext<T>()
  const error = getFieldState(name, useFormState({ control, name })).error?.message

  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60

    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleResend = () => {
    if (timeLeft > 0 && !firstAttempt) return
    onResend()
    setTimeLeft(60)
  }

  return (
    <Field>
      <FieldLabel htmlFor='otp-code'>Verification code</FieldLabel>
      <p className='text-sm text-muted-foreground'>Enter the code sent to your email address.</p>
      <Controller
        name={name}
        control={control}
        render={({ field: { onChange, value } }) => (
          <InputOTP maxLength={OTP_CODE_LENGTH} id='otp-code' value={value} onChange={onChange}>
            <InputOTPGroup>
              {Array.from({ length: OTP_CODE_LENGTH }, (_, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: OTP slots are static and never reordered
                <InputOTPSlot key={index} index={index} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        )}
      />
      <FieldError>{error}</FieldError>
      <p className='text-muted-foreground text-xs'>
        {timeLeft > 0 && !firstAttempt ? (
          `Resend available in ${formatTime(timeLeft)}`
        ) : (
          <>
            {!firstAttempt && "Didn't get the code? "}
            <button
              type='button'
              onClick={(e) => {
                e.preventDefault()
                handleResend()
              }}
              className='hover:text-primary underline'
            >
              {firstAttempt ? 'Send code' : 'Resend code'}
            </button>
          </>
        )}
      </p>
    </Field>
  )
}
