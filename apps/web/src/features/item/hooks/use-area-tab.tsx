import { type AreaNode as AreaNodeType, createAreaNode } from '../components/base/area-node'
import { SidebarArea } from '../components/base/sidebar-area'
import { SidebarHint } from '../components/base/sidebar-hint'
import type { SidebarTabOption } from '../components/base/sidebar-shell'
import { useFlowCenter } from './use-flow-center'

export type UseAreaTabOptions = {
  areas: AreaNodeType[]
  setAreas: React.Dispatch<React.SetStateAction<AreaNodeType[]>>
  readOnly?: boolean
}

/**
 * The "Areas" tab, identical in every diagram — grouping
 * boxes drawn behind the nodes, ordered back to front.
 */
export const useAreaTab = ({
  areas,
  setAreas,
  readOnly,
}: UseAreaTabOptions): SidebarTabOption<'area'> => {
  const flowCenter = useFlowCenter()

  return {
    value: 'area',
    label: 'Areas',
    add: {
      label: 'area',
      onClick: () => setAreas((state) => [...state, createAreaNode(state, flowCenter())]),
    },
    children:
      areas.length === 0 ? (
        <SidebarHint>Add an area to mark e.g. a system boundary.</SidebarHint>
      ) : (
        [...areas]
          .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
          .map((area, i) => (
            <SidebarArea
              key={area.id}
              areaId={area.id}
              data={area.data}
              index={i}
              total={areas.length}
              setAreas={setAreas}
              readOnly={readOnly}
            />
          ))
      ),
  }
}
