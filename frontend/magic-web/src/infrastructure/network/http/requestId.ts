export class StringUtils {
	static generateSessionFingerprint() {
		const keys = [
			navigator.userAgent,
			navigator.hardwareConcurrency,
			screen.width,
			Intl.DateTimeFormat().resolvedOptions().timeZone,
		]
		const data = new TextEncoder().encode(keys.join("|"))
		let hash = 0
		for (let i = 0; i < data.length; i++) {
			hash = (hash << 5) + hash + data[i]
		}
		return Math.abs(hash).toString(16).slice(0, 8)
	}

	static createRequestId() {
		// Part 1: time-based entropy (8 characters).
		const timePart = Math.floor(performance.timeOrigin + performance.now())
			.toString(36)
			.slice(-8)
			.padStart(8, "0")

		// Part 2: cryptographically secure randomness (16 characters).
		const randomBuffer = window.crypto.getRandomValues(new Uint8Array(6))
		const randomPart = Array.from(randomBuffer, (byte) =>
			byte.toString(16).padStart(2, "0"),
		).join("")

		// Part 3: session-context fingerprint (8 characters).
		const contextPart = StringUtils.generateSessionFingerprint()

		return `${timePart}${randomPart}${contextPart}`.toUpperCase()
	}
}

export const createRequestId = StringUtils.createRequestId
