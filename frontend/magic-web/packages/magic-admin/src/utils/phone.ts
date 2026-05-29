import libphonenumber from "libphonenumber-js/mobile"

/**
 * Get libphonenumber object
 * @param phone Phone number
 * @param phoneStateCode Country code
 * @returns libphonenumber object
 */
export function getLibphonenumber(phone: string, phoneStateCode: string) {
	// phone must be digits only
	if (!/^\d+$/.test(phone)) return null

	return libphonenumber(phoneStateCode + phone, {
		defaultCountry: "CN",
		defaultCallingCode: "86",
	})
}

/**
 * Encrypt phone number
 * 1. Validate phone length, skip encryption if invalid
 * 2. Validate phone format, skip encryption if invalid
 * 3. Support country code
 * 4. Custom encryption symbol
 * 5. For Chinese mainland numbers, show first 3 and last 4 digits;
 *    For other countries, show first 2 and last 2, mask middle digits with max(half length, 2)
 *
 * @param phone Phone number
 * @param phoneStateCode Country code
 * @param symbol Encryption symbol
 * @returns Encrypted phone number
 */
export function encryptPhoneWithCountryCode(
	phone: string,
	phoneStateCode: string = "+86",
	symbol: string = "*",
): string {
	if (!phone) return phone

	const match = getLibphonenumber(phone, phoneStateCode)
	if (!match?.isValid()) return phone // Invalid phone number, return as is

	const countryCode = match.countryCallingCode
	const localNumber = match.nationalNumber

	// Chinese mainland number encryption: first 3, last 4
	if (countryCode === "86") {
		if (localNumber.length < 7) return phone // Cannot encrypt
		return `+${countryCode} ${localNumber.slice(0, 3)}${symbol.repeat(4)}${localNumber.slice(
			-4,
		)}`
	}

	// Other countries encryption: first 2, last 2, mask middle max(half length, 2)
	if (localNumber.length < 4) return phone // Cannot encrypt
	const maskLength = Math.max(Math.floor(localNumber.length / 2), 2)
	return `+${countryCode} ${localNumber.slice(0, 2)}${symbol.repeat(
		maskLength,
	)}${localNumber.slice(-2)}`
}

/**
 * Validate phone number
 *
 * @param phone Phone number
 * @param phoneStateCode Country code
 * @returns Whether valid
 */
export function validatePhone(phone: string, phoneStateCode: string): boolean {
	if (!phone) return false

	// phone must be digits only
	if (!/^\d+$/.test(phone)) return false

	return getLibphonenumber(phone, phoneStateCode)?.isValid() ?? false
}
