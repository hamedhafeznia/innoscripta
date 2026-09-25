/** Adds the value if it is absent, removes it if present. Never mutates. */
export function toggle<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
