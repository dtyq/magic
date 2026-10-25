const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates an email after trimming user input. */
export function isValidEmail(value: string): boolean {
  const normalizedValue = value.trim();
  return Boolean(normalizedValue) && EMAIL_PATTERN.test(normalizedValue);
}
