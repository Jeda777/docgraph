import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLoginPath } from '../auth-redirect'
import { authClient } from './auth'
import { ACCOUNTS_QUERY_KEY } from './query-keys'

export const useOtpLogin = () => {
  return useMutation({
    mutationFn: async ({ email, otp }: Parameters<typeof authClient.signIn.emailOtp>[0]) => {
      await authClient.signIn.emailOtp({ email, otp })
    },
  })
}

export const usePasswordLogin = () => {
  return useMutation({
    mutationFn: async ({ email, password }: Parameters<typeof authClient.signIn.email>[0]) => {
      await authClient.signIn.email({ email, password })
    },
  })
}

export const useOtpSend = () => {
  return useMutation({
    mutationFn: async ({
      email,
      type,
    }: Parameters<typeof authClient.emailOtp.sendVerificationOtp>[0]) => {
      await authClient.emailOtp.sendVerificationOtp({ email, type })
    },
  })
}

export const usePasswordReset = () => {
  return useMutation({
    mutationFn: async ({
      email,
      otp,
      password,
    }: Parameters<typeof authClient.emailOtp.resetPassword>[0]) => {
      await authClient.emailOtp.resetPassword({ email, otp, password })
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await authClient.signOut()
    },
    onSettled: () => {
      queryClient.clear()
      const { pathname, search, hash } = window.location
      window.location.href = getLoginPath(pathname + search + hash)
    },
  })
}

export const useAccountGetList = () => {
  return useQuery({
    queryKey: ACCOUNTS_QUERY_KEY,
    queryFn: async () => {
      return await authClient.listAccounts()
    },
  })
}

export const usePasswordChange = () => {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: Parameters<typeof authClient.changePassword>[0]) => {
      await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    },
  })
}
