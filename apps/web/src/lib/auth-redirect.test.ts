import { describe, expect, it } from 'vitest'
import { getLoginPath, getRedirectSearch, getSafeRedirect } from './auth-redirect'

describe('getSafeRedirect', () => {
  it('keeps paths inside the app', () => {
    expect(getSafeRedirect('/projects/1?sort=name#top')).toBe('/projects/1?sort=name#top')
  })

  it.each([null, undefined, '', 'projects/1', 'https://evil.com', '//evil.com', '/\\evil.com'])(
    'falls back to the dashboard for %j',
    (value) => {
      expect(getSafeRedirect(value)).toBe('/')
    },
  )
})

describe('getRedirectSearch', () => {
  it('encodes the path into the redirect param', () => {
    expect(getRedirectSearch('/item/5?x=1')).toBe('?redirect=%2Fitem%2F5%3Fx%3D1')
  })

  it('is empty for the dashboard and unsafe paths', () => {
    expect(getRedirectSearch('/')).toBe('')
    expect(getRedirectSearch('//evil.com')).toBe('')
  })
})

describe('getLoginPath', () => {
  it('points the login page back at the given path', () => {
    expect(getLoginPath('/projects/3')).toBe('/login?redirect=%2Fprojects%2F3')
    expect(getLoginPath('/')).toBe('/login')
  })
})
