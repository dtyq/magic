import { createAbortError } from "../renderer/abort"

/**
 * 若信号已中止则抛出 AbortError
 */
export function ensureNotAborted(signal: AbortSignal): void {
	if (signal.aborted) throw createAbortError()
}
