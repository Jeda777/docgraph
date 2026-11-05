/** Query param on the auth pages holding the app path to return to after logging in. */
export const REDIRECT_PARAM = 'redirect'

/**
 * Accepts only paths inside this app. `//evil.com` and `/\evil.com` are read by browsers as other
 * origins, so they and absolute URLs fall back to the dashboard (no open redirect).
 */
export const getSafeRedirect = (value: string | null | undefined) => {
  if (!value?.startsWith('/')) return '/'
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/'
  } catch {
    return '/'
  }
}

/** The `?redirect=…` search string for a path, empty for the dashboard (the default anyway). */
export const getRedirectSearch = (path: string) => {
  const target = getSafeRedirect(path)
  return target === '/' ? '' : `?${new URLSearchParams({ [REDIRECT_PARAM]: target })}`
}

/** The login page that returns the user to `from` once they are logged in again. */
export const getLoginPath = (from: string) => `/login${getRedirectSearch(from)}`
