import { createTransport, type SendMailOptions } from 'nodemailer'
import { config } from './config'
import { log } from './logger'

const logger = log('mailer')

const transport = config.smtp && createTransport(config.smtp, { from: config.smtp.from })

type Mail = SendMailOptions & { to: string; subject: string }

export const mailer = {
  /**
   * Without SMTP the email is not sent: `logWithoutSmtp` (what the recipient needs from it, e.g.
   * the login code) is logged instead, so the instance stays usable. Anyone with access to the
   * logs can use it.
   */
  sendMail: async (mail: Mail, { logWithoutSmtp }: { logWithoutSmtp: string }) => {
    if (!transport) {
      logger.warn('SMTP is not configured, email "{subject}" to {to} not sent. {content}', {
        subject: mail.subject,
        to: mail.to,
        content: logWithoutSmtp,
      })
      return
    }
    await transport.sendMail(mail)
  },
}
