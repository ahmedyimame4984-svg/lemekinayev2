export function nextGeneratedFieldValue(
  currentValue: string,
  previousGeneratedValue: string,
  nextGeneratedValue: string,
): string {
  if (!currentValue || currentValue === previousGeneratedValue) {
    return nextGeneratedValue;
  }

  return currentValue;
}
