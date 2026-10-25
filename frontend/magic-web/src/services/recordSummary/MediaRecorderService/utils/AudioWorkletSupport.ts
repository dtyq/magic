/** Checks AudioWorklet capability without invoking AudioContext's native getter. */
export function hasAudioWorkletSupport(): boolean {
	try {
		if (typeof window === "undefined") return false

		const win = window as typeof window & {
			webkitAudioContext?: typeof AudioContext
		}
		const AudioContextConstructor = win.AudioContext ?? win.webkitAudioContext

		return Boolean(
			typeof AudioContextConstructor === "function" &&
			"audioWorklet" in AudioContextConstructor.prototype &&
			typeof win.AudioWorkletNode !== "undefined",
		)
	} catch {
		return false
	}
}
