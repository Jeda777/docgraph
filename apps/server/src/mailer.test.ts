import { configure, type LogRecord, reset } from '@logtape/logtape'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { sendMailMock } = vi.hoisted(() => ({
  sendMailMock: vi.fn(async () => undefined),
}))

vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: sendMailMock }) }))

const SMTP_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_TLS', 'SMTP_FROM']
const MAIL = { to: 'jane@test.local', subject: 'Code', html: '<p>123456</p>' }

// The transport is picked from `config` at load time, so every case loads a fresh copy
const loadMailer = async () => {
  vi.resetModules()
  const { mailer } = await import('./mailer')
  return mailer
}

const captureLogs = async () => {
  const records: LogRecord[] = []
  await configure({
    sinks: { memory: (record) => records.push(record) },
    loggers: [{ category: 'app', lowestLevel: 'debug', sinks: ['memory'] }],
    reset: true,
  })
  return records
}

afterEach(async () => {
  vi.unstubAllEnvs()
  sendMailMock.mockClear()
  await reset()
})

describe('mailer.sendMail', () => {
  it('sends through SMTP when it is configured', async () => {
    const mailer = await loadMailer()

    await mailer.sendMail(MAIL, { logWithoutSmtp: 'Code: 123456' })

    expect(sendMailMock).toHaveBeenCalledWith(MAIL)
  })

  it('logs the email content instead of sending when SMTP is not configured', async () => {
    for (const key of SMTP_ENV) vi.stubEnv(key, undefined)
    const records = await captureLogs()
    const mailer = await loadMailer()

    await mailer.sendMail(MAIL, { logWithoutSmtp: 'Code: 123456' })

    expect(sendMailMock).not.toHaveBeenCalled()
    expect(records).toHaveLength(1)
    expect(records[0]?.level).toBe('warning')
    expect(records[0]?.properties).toEqual({
      subject: 'Code',
      to: 'jane@test.local',
      content: 'Code: 123456',
    })
  })
})
