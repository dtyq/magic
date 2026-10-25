import type { MaskingOperations, SensitiveDataConfig } from "./types"

/** Preserve rule order: later rules process the output of earlier replacements. */
export function createDefaultMaskingConfig({
	mask,
	isSensitiveKey,
}: MaskingOperations): SensitiveDataConfig {
	return {
		patterns: [
			{
				// Email addresses.
				pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
			},
			{
				// API keys embedded in text.
				pattern: /(\bapi[_-]?key=)([^&\s]+)/gi,
				replacement: (match) => {
					const parts = match.split("=")
					return parts.length === 2 ? `${parts[0]}=${mask(parts[1])}` : match
				},
			},
			{
				// Bearer JWTs.
				pattern: /(\bbearer\s+)([A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)/gi,
				replacement: (match) => {
					const parts = match.split(/\s+/, 2)
					return parts.length === 2 ? `${parts[0]} ${mask(parts[1])}` : match
				},
			},
			{
				// Chinese national ID numbers.
				pattern:
					/(\b[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx])/g,
			},
			{
				// Consult the current key policy so configuration updates also apply to URLs.
				pattern: /([?&])([^=&]+)=([^&]*)/g,
				replacement: (match, prefix, key, value) => {
					if (
						typeof prefix === "string" &&
						typeof key === "string" &&
						typeof value === "string" &&
						isSensitiveKey(key)
					)
						return `${prefix}${key}=${mask(value)}`
					return match
				},
			},
			{
				// Standalone tokens retain the historical ten-character prefix and suffix.
				pattern: /^[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+$/,
				replacement: (match) => {
					const preserveStart = 10
					const preserveEnd = 10
					if (match.length <= preserveStart + preserveEnd) return match
					const start = match.substring(0, preserveStart)
					const end = match.substring(match.length - preserveEnd)
					const maskedLength = match.length - preserveStart - preserveEnd
					const middle = "*".repeat(Math.min(maskedLength, 8))
					return `${start}${middle}${end}`
				},
			},
		],
		keys: [
			"password",
			"token",
			"secret",
			"auth",
			"account",
			"address",
			"street",
			"phone",
			"email",
			"credit_card",
			"authorization",
			"teamshare_token",
			"login_token",
			"key",
			"api_key",
			"apikey",
		],
		replacement: "[REDACTED]",
		preserveStart: 4,
		preserveEnd: 4,
		maskChar: "*",
		useFixedReplacement: false,
	}
}
