import type { AreaNodeData } from '@docgraph/common/schemas'
import { ArrowDown, ArrowUp, Lock, LockOpen, Trash } from 'lucide-react'
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { AreaNode as AreaNodeType } from './area-node'

export type SidebarAreaProps = {
  areaId: string
  data: AreaNodeType['data']
  index: number
  total: number
  setAreas: React.Dispatch<React.SetStateAction<AreaNodeType[]>>
  readOnly?: boolean
}

export const SidebarArea = memo(
  ({ areaId, data, index, total, setAreas, readOnly }: SidebarAreaProps) => {
    const locked = data.locked ?? false

    const update = (patch: Partial<AreaNodeData>) =>
      setAreas((state) =>
        state.map((a) => (a.id === areaId ? { ...a, data: { ...a.data, ...patch } } : a)),
      )

    const handleMove = (direction: -1 | 1) =>
      setAreas((state) => {
        const ordered = state
          .map((a, i) => ({ a, key: a.data.order ?? i }))
          .sort((x, y) => x.key - y.key)
          .map((x) => x.a)
        const idx = ordered.findIndex((a) => a.id === areaId)
        const target = idx + direction
        if (target < 0 || target >= ordered.length) return state
        ;[ordered[idx], ordered[target]] = [ordered[target], ordered[idx]]
        const orderById = new Map(ordered.map((a, i) => [a.id, i]))
        return state.map((a) => ({
          ...a,
          data: { ...a.data, order: orderById.get(a.id) ?? 0 },
        }))
      })

    const handleDelete = () => setAreas((state) => state.filter((a) => a.id !== areaId))

    return (
      <Card className='shrink-0 rounded-lg p-0 shadow-none' id={`sidebar-area-${areaId}`}>
        <CardContent className='p-2 flex flex-col gap-2'>
          <div className='flex items-center gap-1'>
            <Input
              value={data.name}
              onChange={(e) => update({ name: e.target.value })}
              disabled={readOnly}
            />
            <Button
              variant='ghost'
              size='icon-sm'
              className='shrink-0'
              disabled={readOnly || index === 0}
              onClick={() => handleMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              className='shrink-0'
              disabled={readOnly || index === total - 1}
              onClick={() => handleMove(1)}
            >
              <ArrowDown />
            </Button>
            <Button
              variant='ghost'
              size='icon-sm'
              className='shrink-0'
              onClick={() => update({ locked: !locked })}
              disabled={readOnly}
            >
              {locked ? <Lock /> : <LockOpen />}
            </Button>
            <Button
              variant='destructive'
              size='icon-sm'
              className='shrink-0'
              onClick={handleDelete}
              disabled={readOnly}
            >
              <Trash />
            </Button>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='color'
              value={data.color}
              onChange={(e) => update({ color: e.target.value })}
              disabled={readOnly}
              className='h-8 w-10 shrink-0 cursor-pointer rounded border border-input bg-transparent disabled:cursor-not-allowed disabled:opacity-50'
            />
            <input
              type='range'
              min={0}
              max={1}
              step={0.05}
              value={data.alpha}
              onChange={(e) => update({ alpha: Number(e.target.value) })}
              disabled={readOnly}
              className='flex-1 disabled:cursor-not-allowed disabled:opacity-50'
            />
          </div>
        </CardContent>
      </Card>
    )
  },
)
