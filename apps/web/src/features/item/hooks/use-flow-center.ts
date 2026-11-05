import { useReactFlow } from '@xyflow/react'

/** Flow coordinates of the viewport centre — where newly added nodes land. */
export const useFlowCenter = () => {
  const { screenToFlowPosition } = useReactFlow()

  return () => screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
}
