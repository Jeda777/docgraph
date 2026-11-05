import { afterEach, describe, expect, it, vi } from 'vitest'

const SMTP_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_TLS', 'SMTP_FROM']

// `config` parses process.env at load time, so every case loads a fresh copy of the module
const loadConfig = async () => {
  vi.resetModules()
  const { config } = await import('./config')
  return config
}

const unsetSmtpEnv = () => {
  for (const key of SMTP_ENV) vi.stubEnv(key, undefined)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('config.smtp', () => {
  it('maps a complete SMTP setup', async () => {
    vi.stubEnv('SMTP_TLS', 'true')

    const config = await loadConfig()

    expect(config.smtp).toEqual({
      host: 'localhost',
      port: 3025,
      secure: true,
      auth: { user: 'test-user', pass: 'test-password' },
      from: 'noreply@test.local',
    })
  })

  it('leaves SMTP unconfigured when no SMTP var is set', async () => {
    unsetSmtpEnv()

    const config = await loadConfig()

    expect(config.smtp).toBeNull()
  })

  it.each(SMTP_ENV)('rejects a setup without %s', async (missing) => {
    vi.stubEnv(missing, undefined)

    await expect(loadConfig()).rejects.toThrow(missing)
  })

  it('rejects SMTP vars set without SMTP_HOST', async () => {
    unsetSmtpEnv()
    vi.stubEnv('SMTP_USER', 'test-user')
    vi.stubEnv('SMTP_PASSWORD', 'test-password')

    await expect(loadConfig()).rejects.toThrow('SMTP_HOST')
  })

  it('rejects an invalid SMTP_TLS value', async () => {
    vi.stubEnv('SMTP_TLS', 'yes')

    await expect(loadConfig()).rejects.toThrow('SMTP_TLS')
  })
})

describe('config.db.ssl', () => {
  it('disables TLS by default', async () => {
    vi.stubEnv('DB_SSL', undefined)

    const config = await loadConfig()

    expect(config.db.ssl).toBe(false)
  })

  it.each([
    ['false', false],
    ['true', { rejectUnauthorized: true }],
    ['no-verify', { rejectUnauthorized: false }],
  ])('maps DB_SSL=%s', async (value, expected) => {
    vi.stubEnv('DB_SSL', value)

    const config = await loadConfig()

    expect(config.db.ssl).toEqual(expected)
  })

  it('rejects an unknown DB_SSL value', async () => {
    vi.stubEnv('DB_SSL', 'require')

    await expect(loadConfig()).rejects.toThrow('DB_SSL')
  })
})
