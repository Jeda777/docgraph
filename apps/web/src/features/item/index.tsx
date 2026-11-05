import type { ItemOutput } from '@docgraph/common/schemas'
import { HocuspocusProviderWebsocketComponent, HocuspocusRoom } from '@hocuspocus/provider-react'
import { Suspense, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { PageError } from '@/components/page-error'
import { PageSpinner } from '@/components/page-spinner'
import { getErrorStatus, useItemGetById } from '@/lib/api'
import { parseRouteId } from '@/lib/utils'
import { useCrdtAuthFailure } from './hooks/use-crdt-auth-failure'
import '@xyflow/react/dist/style.css'
import { lazyNamed } from '@/lib/lazy-named'

const DatabaseDiagram = lazyNamed(
  () => import('./components/database-diagram/database-diagram'),
  'DatabaseDiagram',
)
const BusinessProcessDiagram = lazyNamed(
  () => import('./components/business-process/business-process'),
  'BusinessProcessDiagram',
)
const DocumentEditor = lazyNamed(
  () => import('./components/document/document-editor'),
  'DocumentEditor',
)
const FlowchartDiagram = lazyNamed(
  () => import('./components/flowchart/flowchart'),
  'FlowchartDiagram',
)

type CrdtAuthFailureProps = { refetchItem: () => Promise<{ error: unknown }> }

/** Rendered inside the room, where the provider hooks are available. */
const CrdtAuthFailure = ({ refetchItem }: CrdtAuthFailureProps) => {
  useCrdtAuthFailure(refetchItem)
  return null
}

const renderItem = (item: ItemOutput, connected: boolean) => {
  switch (item.type) {
    case 'BUSINESS_PROCESS':
      return <BusinessProcessDiagram connected={connected} itemName={item.name} />
    case 'DATABASE_DIAGRAM':
      return <DatabaseDiagram connected={connected} itemName={item.name} />
    case 'DOCUMENT':
      return <DocumentEditor connected={connected} itemName={item.name} />
    case 'FLOWCHART':
      return <FlowchartDiagram connected={connected} itemName={item.name} />
  }
}

export const ItemPage = () => {
  const itemId = parseRouteId(useParams<{ itemId: string }>().itemId)
  const [connected, setConnected] = useState(false)

  const { data, error, isFetching, refetch } = useItemGetById(itemId ?? '', itemId !== null)

  // Only an item that doesn't exist sends the user away; other failures may pass on retry.
  if (itemId === null || getErrorStatus(error) === 404) {
    return <Navigate to='/' replace />
  }

  if (!data) {
    if (error && !isFetching)
      return <PageError error={error} onRetry={() => refetch()} fullScreen />
    return <PageSpinner fullScreen />
  }

  return (
    <HocuspocusProviderWebsocketComponent url={`${location.origin}/ws`}>
      <HocuspocusRoom name={itemId} onStatus={(e) => setConnected(e.status === 'connected')}>
        <CrdtAuthFailure refetchItem={refetch} />
        <Suspense fallback={<PageSpinner fullScreen />}>{renderItem(data, connected)}</Suspense>
      </HocuspocusRoom>
    </HocuspocusProviderWebsocketComponent>
  )
}
