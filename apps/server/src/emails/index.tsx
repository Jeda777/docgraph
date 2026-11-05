import { render } from 'react-email'
import { Invitation, type InvitationProps } from './invitation'
import { LOGO_ATTACHMENT } from './logo'
import { Otp, type OtpProps } from './otp'

/**
 * Files every email carries: the templates show the logo through `cid:`. A new array per email,
 * so a caller adding a file to one email can't add it to all later ones.
 */
const attachments = () => [{ ...LOGO_ATTACHMENT }]

export const renderInvitation = async (props: InvitationProps) => ({
  subject: 'DocGraph Invitation',
  html: await render(<Invitation {...props} />),
  attachments: attachments(),
})

export const renderOtp = async (props: OtpProps) => ({
  subject: 'DocGraph Verification Code',
  html: await render(<Otp {...props} />),
  attachments: attachments(),
})
