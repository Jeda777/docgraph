export type EditCaretProps = {
  color: string
}

export const EditCaret = ({ color }: EditCaretProps) => (
  <span
    aria-hidden
    className='inline-block w-0.5 h-3.5 ml-px align-text-bottom animate-caret-blink'
    style={{ background: color }}
  />
)
