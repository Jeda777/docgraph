import { Button, Link, Text } from 'react-email'
import { BaseTemplate } from './base-template'
import { LOGO_DATA_URI } from './logo'

export type InvitationProps = {
  name: string
  url: string
  /** See `TopLogoProps.src`. */
  logoSrc?: string
}

export const Invitation = ({ name, url, logoSrc }: InvitationProps) => {
  return (
    <BaseTemplate
      name={name}
      previewText='You have been invited to join DocGraph'
      logoSrc={logoSrc}
    >
      <Text className='text-neutral-600 mb-6 mt-0 text-base'>
        You have been invited to join DocGraph. Log in to get started.
      </Text>
      <Button
        className='bg-emerald-600 px-5 py-3 rounded-lg text-white text-base font-bold'
        href={url}
      >
        Log in to DocGraph
      </Button>
      <Text className='mt-7 mb-2 text-neutral-600'>
        If the button does not work, copy and paste this link into your browser:
      </Text>
      <Link href={url} className='text-emerald-600 break-all text-sm'>
        {url}
      </Link>
    </BaseTemplate>
  )
}

Invitation.PreviewProps = {
  url: 'https://docgraph.invalid/login',
  name: 'John Doe',
  logoSrc: LOGO_DATA_URI,
} as InvitationProps

export default Invitation
