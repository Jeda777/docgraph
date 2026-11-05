import type { ReactNode } from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  pixelBasedPreset,
  Tailwind,
} from 'react-email'
import { TopLogo } from './top-logo'

export type BaseTemplateProps = {
  previewText: string
  name: string
  children: ReactNode
  /** See `TopLogoProps.src`. */
  logoSrc?: string
}

export const BaseTemplate = ({ previewText, name, children, logoSrc }: BaseTemplateProps) => {
  return (
    <Html>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Head />
        <Preview>{previewText}</Preview>
        <Body style={{ fontFamily: 'Arial, sans-serif' }} className='bg-neutral-50 m-0'>
          <Container className='mx-auto max-w-lg p-8'>
            <TopLogo src={logoSrc} />
            <Heading className='text-neutral-900 mb-4 mt-0 text-2xl font-bold'>
              Welcome, {name}!
            </Heading>
            {children}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
