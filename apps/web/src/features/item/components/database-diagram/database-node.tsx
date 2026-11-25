import {
  columnHandleId,
  type DATABASE_DIAGRAM_NODE_TYPE,
  type DatabaseDiagramNodeData,
} from '@docgraph/common/schemas'
import { type Node, type NodeProps, Position } from '@xyflow/react'
import { Fragment, memo } from 'react'
import { cn } from '@/lib/utils'
import { useRemoteNodeEditors } from '../../hooks/use-remote-node-editors'
import { BaseNode, BaseNodeContent, BaseNodeHeader, BaseNodeHeaderTitle } from '../base/base-node'
import { EditCaret } from '../base/edit-caret'
import { NodeHandle } from '../base/node-handle'
import { getDataTypeColor } from './data-types'

export type DatabaseNode = Node<DatabaseDiagramNodeData, typeof DATABASE_DIAGRAM_NODE_TYPE>

export const DatabaseNode = memo(
  ({
    id,
    data: { color, name, values, constraints, checks, description },
  }: NodeProps<DatabaseNode>) => {
    const editors = useRemoteNodeEditors(id)

    return (
      <BaseNode
        style={{
          background: `linear-gradient(to bottom, var(--color-${color}-500) 0, var(--color-${color}-500) 8px, var(--card) 8px, var(--card) 100%)`,
        }}
        className='pt-2'
      >
        <BaseNodeHeader className='px-2 pt-0 pb-1 flex flex-col bg-muted'>
          <BaseNodeHeaderTitle className='text-sm'>
            {name}
            {editors.name && <EditCaret color={editors.name} />}
          </BaseNodeHeaderTitle>
          {(description || editors.description) && (
            <p className='text-xs max-w-min text-muted-foreground'>
              {description}
              {editors.description && <EditCaret color={editors.description} />}
            </p>
          )}
          {constraints?.map((c) => {
            const parts = [
              ...values.filter((v) => c.columns.includes(v.id)).map((v) => v.name),
              ...(c.expressions ?? []).filter((expression) => expression.trim()),
            ]
            const editor = editors[`constraint:${c.id}`]
            if (!parts.length && !editor) return null
            return (
              <p key={c.id} className='text-xs text-muted-foreground'>
                <span className='font-semibold uppercase'>{c.type}</span> ({parts.join(', ')})
                {editor && <EditCaret color={editor} />}
              </p>
            )
          })}
          {checks
            ?.filter((check) => check.expression.trim() || editors[`check:${check.id}`])
            .map((check) => (
              <p key={check.id} className='text-xs text-muted-foreground'>
                <span className='font-semibold uppercase'>Check</span>
                {check.name && ` ${check.name}`} ({check.expression})
                {editors[`check:${check.id}`] && <EditCaret color={editors[`check:${check.id}`]} />}
              </p>
            ))}
        </BaseNodeHeader>

        <BaseNodeContent className='text-xs'>
          {values.map((x) => {
            const color = getDataTypeColor(x.value)

            return (
              <Fragment key={x.id}>
                <div className='text-nowrap relative w-full value flex items-center justify-between gap-2'>
                  <NodeHandle id={columnHandleId(x.id, 'left')} position={Position.Left} />

                  <p>
                    {x.name}
                    {editors[`value:${x.id}:name`] && (
                      <EditCaret color={editors[`value:${x.id}:name`]} />
                    )}
                    :{' '}
                    <span className={cn('font-semibold', color && `text-${color}-500`)}>
                      {x.value}
                    </span>
                    {editors[`value:${x.id}:value`] && (
                      <EditCaret color={editors[`value:${x.id}:value`]} />
                    )}
                    {(x.defaultValue || editors[`value:${x.id}:defaultValue`]) && (
                      <span className='ml-1 inline-block max-w-40 truncate align-bottom text-muted-foreground'>
                        = {x.defaultValue}
                        {editors[`value:${x.id}:defaultValue`] && (
                          <EditCaret color={editors[`value:${x.id}:defaultValue`]} />
                        )}
                      </span>
                    )}
                  </p>
                  <div className='flex items-center gap-0.5'>
                    {x.primaryKey && <p className='font-bold text-amber-500'>PK</p>}
                    {x.foreignKey && <p className='font-bold text-sky-500'>FK</p>}
                    {x.index && <p className='font-bold'>I</p>}
                    {x.unsigned && <p className='font-bold'>UN</p>}
                    {x.increment && <p className='font-bold'>AI</p>}
                    {x.unique && <p className='font-bold'>U</p>}
                    {x.nullable && <p className='font-bold'>N</p>}
                  </div>

                  <NodeHandle id={columnHandleId(x.id, 'right')} position={Position.Right} />
                </div>
                {(x.description || editors[`value:${x.id}:valueDescription`]) && (
                  <p className='-mx-3 -mt-1.5 bg-muted text-xs text-muted-foreground px-2 pb-1 whitespace-pre-wrap'>
                    {x.description}
                    {editors[`value:${x.id}:valueDescription`] && (
                      <EditCaret color={editors[`value:${x.id}:valueDescription`]} />
                    )}
                  </p>
                )}
              </Fragment>
            )
          })}
        </BaseNodeContent>
      </BaseNode>
    )
  },
)
