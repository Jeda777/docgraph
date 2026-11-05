import { Column, Img, Row, Text } from 'react-email'
import { LOGO_CID } from './logo'

export type TopLogoProps = {
  /**
   * Image URL of the logo. Sent emails keep the default `cid:` URL of the inline attachment
   * (`LOGO_ATTACHMENT`); the react-email preview can't resolve it and passes `LOGO_DATA_URI`.
   */
  src?: string
}

export const TopLogo = ({ src = `cid:${LOGO_CID}` }: TopLogoProps) => {
  return (
    <Row className='mb-8'>
      <Column width='42' className='align-middle'>
        <Img src={src} width='30' height='40' alt='' className='block' />
      </Column>
      <Column className='align-middle'>
        <Text className='m-0 text-emerald-600 text-2xl font-bold'>DocGraph</Text>
      </Column>
    </Row>
  )
}
