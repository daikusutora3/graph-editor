export function stripUndefinedProperties<T extends Record<string, unknown>>(
  value: T,
): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T;
}

export function sameSerializableValue(a: unknown, b: unknown) {
  if (Object.is(a, b)) {
    return true;
  }

  return JSON.stringify(a) === JSON.stringify(b);
}
