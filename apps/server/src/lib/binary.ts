/** Coerce anything the wire or the database may hand us into `Uint8Array`, else null. */
export const toUint8Array = (data: unknown): Uint8Array | null => {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return null
}
