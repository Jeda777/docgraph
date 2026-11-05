import { render as renderEmail } from 'react-email'
import { describe, expect, it } from 'vitest'
import { renderInvitation, renderOtp } from '.'
import { Invitation } from './invitation'
import { LOGO_CID, LOGO_DATA_URI } from './logo'
import { Otp } from './otp'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const renders = {
  invitation: () => renderInvitation({ name: 'Jane', url: 'https://docgraph.invalid/login' }),
  otp: () => renderOtp({ name: 'Jane', otp: '123456', type: 'sign-in', validMinutes: 3 }),
}

describe.each(Object.entries(renders))('%s email', (_, render) => {
  it('shows the logo from an inline PNG attachment', async () => {
    const mail = await render()

    expect(mail.html).toContain(`src="cid:${LOGO_CID}"`)
    expect(mail.attachments).toHaveLength(1)
    const [logo] = mail.attachments
    expect(logo).toMatchObject({ cid: LOGO_CID, contentType: 'image/png' })
    expect(logo.content.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
  })

  it('gives every email its own list of attachments', async () => {
    const first = await render()
    first.attachments.push({ ...first.attachments[0], cid: 'extra' })

    expect((await render()).attachments).toHaveLength(1)
  })
})

describe('react-email preview', () => {
  const previews = {
    invitation: () => renderEmail(<Invitation {...Invitation.PreviewProps} />),
    otp: () => renderEmail(<Otp {...Otp.PreviewProps} />),
  }

  it.each(Object.entries(previews))('shows the logo as a data URL in %s', async (_, preview) => {
    const html = await preview()

    expect(html).toContain(`src="${LOGO_DATA_URI}"`)
    expect(html).not.toContain('cid:')
  })
})
