import libphonenumber from "libphonenumber-js/mobile";

/** Country calling codes shared by the tenant and organization forms. */
export const phoneCountryCodeOptions = ["+86", "+1", "+44", "+65", "+81", "+82"] as const;

export function getPhoneCountryCodeOptions(currentValue?: string): readonly string[] {
  const normalizedValue = currentValue?.trim() || "+86";
  return phoneCountryCodeOptions.includes(
    normalizedValue as (typeof phoneCountryCodeOptions)[number],
  )
    ? phoneCountryCodeOptions
    : [normalizedValue, ...phoneCountryCodeOptions];
}

/** Normalizes a country calling code to the `+86` form used by API payloads. */
export function normalizePhoneCountryCode(countryCode: string): string {
  const normalizedCountryCode = countryCode.trim();
  return normalizedCountryCode.startsWith("+")
    ? normalizedCountryCode
    : `+${normalizedCountryCode}`;
}

/** Combines a local mobile number and country calling code for API payloads. */
export function formatInternationalPhoneNumber(value: string, countryCode: string): string {
  return `${normalizePhoneCountryCode(countryCode)}${value.trim()}`;
}

/** Validates an international mobile number that already includes its calling code. */
export function isValidInternationalPhoneNumber(value: string): boolean {
  const normalizedPhone = value.trim();
  if (!/^\+\d+$/.test(normalizedPhone)) return false;

  try {
    return libphonenumber(normalizedPhone)?.isValid() ?? false;
  } catch {
    return false;
  }
}

/**
 * Validates a phone number using the same country-code-aware rules as the tenant form.
 * The country code may be supplied with or without a leading plus sign.
 */
export function isValidPhoneNumber(value: string, countryCode: string): boolean {
  const normalizedPhone = value.trim();
  const normalizedCountryCode = normalizePhoneCountryCode(countryCode);

  if (!normalizedPhone || !/^\d+$/.test(normalizedPhone)) return false;
  if (!/^\+\d{1,4}$/.test(normalizedCountryCode)) return false;

  try {
    return isValidInternationalPhoneNumber(`${normalizedCountryCode}${normalizedPhone}`);
  } catch {
    return false;
  }
}
