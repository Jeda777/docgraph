import type { DatabaseDiagramEnum, DatabaseDiagramNodeDataValue } from '@docgraph/common/schemas'
import { memo } from 'react'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/reui/autocomplete'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useEditingPresence } from '@/features/item/hooks/use-editing-presence'
import { columnTypeOptions, enumValueDefault } from '../../data-types'
import type { DatabaseNode as DatabaseNodeType } from '../../database-node'
import { type OptionalColumnField, TableColumnDropdown } from './table-column-dropdown'

export type SidebarTableColumnProps = {
  nodeId: string
  value: DatabaseDiagramNodeDataValue
  index: number
  total: number
  setNodes: React.Dispatch<React.SetStateAction<DatabaseNodeType[]>>
  /** Enums of the diagram, offered as column types. */
  enums?: readonly DatabaseDiagramEnum[]
  readOnly?: boolean
}

export const SidebarTableColumn = memo(
  ({ nodeId, value, index, total, setNodes, enums = [], readOnly }: SidebarTableColumnProps) => {
    const { id, name, defaultValue, description } = value
    const { startEditing, stopEditing } = useEditingPresence()
    const enumTypes = enums.map((item) => item.name.trim()).filter(Boolean)
    const enumValues = enums
      .find((item) => item.name.trim() === value.value.trim())
      ?.values.filter((enumValue) => enumValue.name.trim())
    const defaultLabel = enumValues?.find(
      (enumValue) => enumValueDefault(enumValue.name) === defaultValue,
    )?.name

    const handleChangeNodeValue = (newValue: Partial<DatabaseDiagramNodeDataValue>) =>
      setNodes((state) =>
        state.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  values: n.data.values.map((v) =>
                    v.id === newValue.id ? { ...v, ...newValue } : v,
                  ),
                },
              }
            : n,
        ),
      )

    const handleRemoveField = (field: OptionalColumnField) =>
      setNodes((state) =>
        state.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  values: n.data.values.map((v) => {
                    if (v.id !== id) return v
                    const { [field]: _removed, ...rest } = v
                    return rest
                  }),
                },
              }
            : n,
        ),
      )

    const handleMoveNodeValue = (direction: -1 | 1) =>
      setNodes((state) =>
        state.map((n) => {
          if (n.id !== nodeId) return n
          const values = [...n.data.values]
          const target = index + direction
          if (target < 0 || target >= values.length) return n
          ;[values[index], values[target]] = [values[target], values[index]]
          return { ...n, data: { ...n.data, values } }
        }),
      )

    const handleDeleteNodeValue = (id: DatabaseNodeType['data']['values'][number]['id']) =>
      setNodes((state) =>
        state.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  values: n.data.values.filter((v) => v.id !== id),
                },
              }
            : n,
        ),
      )

    return (
      <>
        <div className='flex gap-1 items-center'>
          <Input
            type='text'
            aria-label='Column name'
            value={name}
            onChange={(e) => handleChangeNodeValue({ id, name: e.target.value })}
            onFocus={() => startEditing(nodeId, `value:${id}:name`)}
            onBlur={stopEditing}
            disabled={readOnly}
          />

          <Autocomplete
            items={columnTypeOptions(enumTypes)}
            value={value.value}
            onValueChange={(e) => handleChangeNodeValue({ id, value: e })}
            autoHighlight
          >
            <AutocompleteInput
              aria-label='Column type'
              onFocus={() => startEditing(nodeId, `value:${id}:value`)}
              onBlur={stopEditing}
              disabled={readOnly}
            />
            <AutocompleteContent>
              <AutocompleteEmpty>{value.value}</AutocompleteEmpty>
              <AutocompleteList>
                {(item) => (
                  <AutocompleteItem key={item} value={item}>
                    {item}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>

          <TableColumnDropdown
            handleChangeNodeValue={handleChangeNodeValue}
            handleDeleteNodeValue={handleDeleteNodeValue}
            handleMoveNodeValue={handleMoveNodeValue}
            handleRemoveField={handleRemoveField}
            isFirst={index === 0}
            isLast={index === total - 1}
            value={value}
            readOnly={readOnly}
          />
        </div>

        {defaultValue !== undefined && enumValues && (
          <Select
            value={defaultValue}
            onValueChange={(next) => handleChangeNodeValue({ id, defaultValue: next ?? '' })}
          >
            <SelectTrigger aria-label='Column default' className='w-full' disabled={readOnly}>
              <SelectValue>{defaultLabel ?? (defaultValue || 'Choose a value')}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {enumValues.map((enumValue) => (
                <SelectItem key={enumValue.id} value={enumValueDefault(enumValue.name)}>
                  {enumValue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {defaultValue !== undefined && !enumValues && (
          <Input
            type='text'
            aria-label='Column default'
            placeholder='Default, e.g. 0, now()'
            value={defaultValue}
            onChange={(e) => handleChangeNodeValue({ id, defaultValue: e.target.value })}
            onFocus={() => startEditing(nodeId, `value:${id}:defaultValue`)}
            onBlur={stopEditing}
            disabled={readOnly}
          />
        )}

        {description !== undefined && (
          <Textarea
            aria-label='Column description'
            value={description}
            placeholder='Description'
            onChange={(e) => handleChangeNodeValue({ id, description: e.target.value })}
            onFocus={() => startEditing(nodeId, `value:${id}:valueDescription`)}
            onBlur={stopEditing}
            disabled={readOnly}
          />
        )}
      </>
    )
  },
)
