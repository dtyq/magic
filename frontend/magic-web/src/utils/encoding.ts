/**
 * Safe base64 encoding utilities to handle Unicode characters
 */

/**
 * Safely encode string to base64, handles Unicode characters
 * @param str - String to encode
 * @returns Base64 encoded string or empty string if encoding fails
 */
export function safeBtoa(str: string): string {
	try {
		// Use encodeURIComponent to handle Unicode characters before btoa
		return btoa(encodeURIComponent(str))
	} catch (error) {
		console.error("Failed to encode string to base64:", error)
		return ""
	}
}

/**
 * Safely decode base64 string, handles Unicode characters
 * @param str - Base64 string to decode
 * @returns Decoded string or empty string if decoding fails
 */
export function safeAtob(str: string): string {
	try {
		// Decode base64 then decode URI component
		return decodeURIComponent(atob(str))
	} catch (error) {
		console.error("Failed to decode base64 string:", error)
		return ""
	}
}

/**
 * Safely encode JSON object to base64
 * @param obj - Object to encode
 * @returns Base64 encoded JSON string or empty string if encoding fails
 */
export function safeJsonToBtoa(obj: any): string {
	try {
		const jsonString = JSON.stringify(obj ?? {})
		return safeBtoa(jsonString)
	} catch (error) {
		console.error("Failed to encode JSON to base64:", error)
		return ""
	}
}

/**
 * Safely decode base64 JSON string to object
 * @param str - Base64 encoded JSON string
 * @returns Parsed object or null if decoding fails
 */
export function safeBtoaToJson<T = any>(str: string): T | null {
	try {
		const jsonString = safeAtob(str)
		return JSON.parse(jsonString)
	} catch (error) {
		console.error("Failed to decode base64 JSON:", error)
		return null
	}
}

/**
 * Safely encode binary data (ArrayBuffer or Uint8Array) to base64
 * @param buffer - Binary data to encode
 * @returns Base64 encoded string or empty string if encoding fails
 */
export function safeBinaryToBtoa(buffer: ArrayBuffer | Uint8Array): string {
	try {
		const uint8Array = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
		let binaryString = ""

		// Process in chunks to avoid call stack overflow for large buffers
		const chunkSize = 0x8000 // 32KB chunks
		for (let i = 0; i < uint8Array.length; i += chunkSize) {
			const chunk = uint8Array.subarray(i, i + chunkSize)
			binaryString += String.fromCharCode.apply(null, Array.from(chunk))
		}

		return btoa(binaryString)
	} catch (error) {
		console.error("Failed to encode binary data to base64:", error)
		return ""
	}
}

/**
 * Check if a string is valid base64
 * @param str - String to check
 * @returns True if valid base64, false otherwise
 */
export function isValidBase64(str: string): boolean {
	if (!str || str.length === 0) return false
	try {
		return btoa(atob(str)) === str
	} catch {
		return false
	}
}
