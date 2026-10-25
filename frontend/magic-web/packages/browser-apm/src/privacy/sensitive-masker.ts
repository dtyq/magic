import { createDefaultMaskingConfig } from "./defaults"
import type { SensitiveDataConfig } from "./types"

/** Sanitizes outbound APM payloads without changing the original objects. */
export class SensitiveMasker {
	static config: SensitiveDataConfig = createDefaultMaskingConfig({
		mask: (value) => SensitiveMasker.mask(value),
		isSensitiveKey: (key) => SensitiveMasker.isSensitiveKey(key),
	})

	/**
	 * @description Mask sensitive data.
	 * @param value Value to mask.
	 * @returns The masked value.
	 */
	static mask(value: string): string {
		if (!value || typeof value !== "string") {
			return SensitiveMasker.config.replacement
		}

		// Use fixed replacement text when configured.
		if (SensitiveMasker.config.useFixedReplacement) {
			return SensitiveMasker.config.replacement
		}

		const preserveStart = SensitiveMasker.config.preserveStart || 0
		const preserveEnd = SensitiveMasker.config.preserveEnd || 0
		const maskChar = SensitiveMasker.config.maskChar || "*"

		// Mask every character when the value is too short to preserve both ends safely.
		if (value.length <= preserveStart + preserveEnd) {
			return maskChar.repeat(value.length)
		}

		const start = value.substring(0, preserveStart)
		const end = value.substring(value.length - preserveEnd)
		const maskedLength = value.length - preserveStart - preserveEnd
		const middle = maskChar.repeat(Math.min(maskedLength, 8)) // Cap the number of masking characters.

		return `${start}${middle}${end}`
	}

	/**
	 * @description Sanitize sensitive data.
	 * @param data Data to sanitize.
	 * @returns The sanitized data.
	 */
	static sanitize(data: unknown): unknown {
		if (data === null || data === undefined) {
			return data
		}

		if (typeof data === "function") {
			return "[FUNCTION]"
		}

		if (typeof data === "string") {
			const sanitized = SensitiveMasker.parsePattern(data)

			return SensitiveMasker.safeStringify(sanitized)
		}

		if (typeof data === "object") {
			if (Array.isArray(data)) {
				return data.map((item) => SensitiveMasker.sanitize(item))
			}

			// Create a copy to avoid mutating the original object.
			const sanitized: Record<string, unknown> = {}

			for (const [key, value] of Object.entries(data)) {
				// Check whether the key requires masking.
				if (SensitiveMasker.isSensitiveKey(key)) {
					sanitized[key] =
						typeof value === "string"
							? SensitiveMasker.mask(value)
							: SensitiveMasker.sanitize(value)
				} else {
					// Recursively sanitize nested objects.
					sanitized[key] = SensitiveMasker.sanitize(value)
				}
			}

			return sanitized
		}

		// Preserve other values unchanged.
		return data
	}

	/**
	 * @description Apply masking rules.
	 * @param value Value to process.
	 * @returns The processed value.
	 */
	private static parsePattern(value: string) {
		let sanitized = value
		try {
			SensitiveMasker.config.patterns?.forEach((patternObj) => {
				const { pattern, replacement } = patternObj
				if (pattern.test(sanitized)) {
					sanitized = sanitized.replace(pattern, (match, ...args) => {
						try {
							// Use a custom replacement function when provided.
							if (typeof replacement === "function") {
								return replacement(match, ...args)
							}
							// Use fixed replacement text when provided.
							if (typeof replacement === "string") {
								return replacement
							}
							// Otherwise, use the default mask method.
							return SensitiveMasker.mask(match)
						} catch (error) {
							console.error(error)
							return match
						}
					})
				}
			})
		} catch (error) {
			console.error("Regular parsing exception", error)
		}
		return sanitized
	}

	/**
	 * @description Create a replacer function for JSON.stringify.
	 * Pass it directly as the second argument to JSON.stringify.
	 * @example JSON.stringify(data, SensitiveMasker.getJSONReplacer())
	 * @returns A JSON.stringify replacer function.
	 */
	private static getJSONReplacer(): (key: string, value: unknown) => unknown {
		return function (key: string, value: unknown) {
			// Check whether this is a sensitive key.
			if (SensitiveMasker.isSensitiveKey(key)) {
				// Mask string values.
				return typeof value === "string" ? SensitiveMasker.mask(value) : "[MASKED OBJECT]"
			}

			// Check string values against sensitive patterns.
			if (typeof value === "string") {
				return SensitiveMasker.parsePattern(value)
			}

			// Return the original value for further processing.
			return value
		}
	}

	/**
	 * @description Safely serialize parsed JSON while masking sensitive data.
	 * @param data JSON string to sanitize.
	 * @param space Number of spaces used for indentation.
	 * @returns The sanitized JSON string.
	 */
	private static safeStringify(data: string, space?: number): string {
		try {
			return JSON.stringify(JSON.parse(data), SensitiveMasker.getJSONReplacer(), space)
		} catch (error) {
			return data
		}
	}

	private static isSensitiveKey(key: string): boolean {
		return (
			SensitiveMasker.config.keys?.some((sensitiveKey) =>
				key.toLowerCase().includes(sensitiveKey.toLowerCase()),
			) ?? false
		)
	}
}
