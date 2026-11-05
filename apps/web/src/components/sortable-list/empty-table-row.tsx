import { TableCell, TableRow } from '../ui/table'

export type EmptyTableRowProps = {
  colSpan: number
  text: string
}

export const EmptyTableRow = ({ colSpan, text }: EmptyTableRowProps) => {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className='h-24 text-center text-muted-foreground'>
        {text}
      </TableCell>
    </TableRow>
  )
}
