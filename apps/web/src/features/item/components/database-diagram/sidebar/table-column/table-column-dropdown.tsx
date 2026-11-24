import type { DatabaseDiagramNodeDataValue } from '@docgraph/common/schemas'
import { ArrowDown, ArrowUp, Menu, Plus, Trash, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isNumericType } from '../../data-types'

/** Column fields that are absent until added from the menu. */
export type OptionalColumnField = keyof Pick<
  DatabaseDiagramNodeDataValue,
  'defaultValue' | 'description'
>

export type TableColumnDropdownProps = {
  value: DatabaseDiagramNodeDataValue
  isLast: boolean
  isFirst: boolean
  handleChangeNodeValue: (newValue: Partial<DatabaseDiagramNodeDataValue>) => void
  handleMoveNodeValue: (direction: -1 | 1) => void
  handleDeleteNodeValue: (id: DatabaseDiagramNodeDataValue['id']) => void
  handleRemoveField: (field: OptionalColumnField) => void
  readOnly?: boolean
}

export const TableColumnDropdown = ({
  value: {
    foreignKey,
    id,
    primaryKey,
    unique,
    unsigned,
    increment,
    nullable,
    defaultValue,
    description,
    index: isIndex,
    value,
  },
  isFirst,
  isLast,
  handleChangeNodeValue,
  handleMoveNodeValue,
  handleDeleteNodeValue,
  handleRemoveField,
  readOnly,
}: TableColumnDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size='icon-sm' variant='ghost' aria-label='Column options' disabled={readOnly} />
        }
      >
        <Menu />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={primaryKey}
          onCheckedChange={(e) => handleChangeNodeValue({ id, primaryKey: e })}
        >
          Primary Key
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={foreignKey}
          onCheckedChange={(e) => handleChangeNodeValue({ id, foreignKey: e })}
        >
          Foreign Key
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={isIndex}
          onCheckedChange={(e) => handleChangeNodeValue({ id, index: e })}
        >
          Index
        </DropdownMenuCheckboxItem>

        {isNumericType(value) && (
          <DropdownMenuCheckboxItem
            checked={unsigned ?? false}
            onCheckedChange={(e) => handleChangeNodeValue({ id, unsigned: e })}
          >
            Unsigned
          </DropdownMenuCheckboxItem>
        )}

        {(isNumericType(value) || increment) && (
          <DropdownMenuCheckboxItem
            checked={increment ?? false}
            onCheckedChange={(e) => handleChangeNodeValue({ id, increment: e })}
          >
            Auto Increment
          </DropdownMenuCheckboxItem>
        )}

        <DropdownMenuCheckboxItem
          checked={unique}
          onCheckedChange={(e) => handleChangeNodeValue({ id, unique: e })}
        >
          Unique
        </DropdownMenuCheckboxItem>

        <DropdownMenuCheckboxItem
          checked={nullable}
          onCheckedChange={(e) => handleChangeNodeValue({ id, nullable: e })}
        >
          Nullable
        </DropdownMenuCheckboxItem>

        <DropdownMenuItem
          className='cursor-pointer'
          closeOnClick={false}
          disabled={isFirst}
          onClick={() => handleMoveNodeValue(-1)}
        >
          <ArrowUp /> Move up
        </DropdownMenuItem>

        <DropdownMenuItem
          className='cursor-pointer'
          closeOnClick={false}
          disabled={isLast}
          onClick={() => handleMoveNodeValue(1)}
        >
          <ArrowDown /> Move down
        </DropdownMenuItem>

        {defaultValue === undefined && (
          <DropdownMenuItem
            className='cursor-pointer'
            closeOnClick={false}
            onClick={() => handleChangeNodeValue({ id, defaultValue: '' })}
          >
            <Plus /> Add default
          </DropdownMenuItem>
        )}

        {defaultValue !== undefined && (
          <DropdownMenuItem
            className='cursor-pointer'
            onClick={() => handleRemoveField('defaultValue')}
          >
            <X /> Remove default
          </DropdownMenuItem>
        )}

        {description === undefined && (
          <DropdownMenuItem
            className='cursor-pointer'
            closeOnClick={false}
            onClick={() => handleChangeNodeValue({ id, description: '' })}
          >
            <Plus /> Add description
          </DropdownMenuItem>
        )}

        {description !== undefined && (
          <DropdownMenuItem
            className='cursor-pointer'
            onClick={() => handleRemoveField('description')}
          >
            <X /> Remove description
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          variant='destructive'
          className='cursor-pointer hover:bg-muted transition-all'
          onClick={() => handleDeleteNodeValue(id)}
        >
          <Trash /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
