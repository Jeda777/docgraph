/** Values that occur more than once, each listed once, in order of first repetition. */
export const findDuplicates = <T>(values: readonly T[]): T[] => [
  ...new Set(values.filter((value, index) => values.indexOf(value) !== index)),
]
