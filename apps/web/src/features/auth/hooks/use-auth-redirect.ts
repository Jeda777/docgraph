import { useLocation } from 'react-router'
import { getRedirectSearch, getSafeRedirect, REDIRECT_PARAM } from '@/lib/auth-redirect'

/**
 * Where to go after logging in (the page the user was on when the session ended) and the search
 * string that carries it between the auth pages (login ↔ OTP ↔ reset).
 */
export const useAuthRedirect = () => {
  const { search } = useLocation()
  const redirectTo = getSafeRedirect(new URLSearchParams(search).get(REDIRECT_PARAM))
  return { redirectTo, redirectSearch: getRedirectSearch(redirectTo) }
}
