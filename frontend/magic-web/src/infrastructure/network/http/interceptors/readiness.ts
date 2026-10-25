import type { RequestInterceptor, ServiceClientBindings } from "../clients/types"

/** The application owns readiness; the transport only enforces cancellation while waiting. */
export function waitWithSignal(
	promise: Promise<unknown>,
	signal?: AbortSignal | null,
): Promise<void> {
	if (signal?.aborted) return Promise.reject(signal.reason)
	return new Promise((resolve, reject) => {
		const abort = () => {
			cleanup()
			reject(signal?.reason ?? new DOMException("Aborted", "AbortError"))
		}
		const cleanup = () => signal?.removeEventListener("abort", abort)
		signal?.addEventListener("abort", abort, { once: true })
		promise.then(
			() => {
				cleanup()
				resolve()
			},
			(error) => {
				cleanup()
				reject(error)
			},
		)
	})
}

export function createReadinessInterceptor(
	gate: ServiceClientBindings["readiness"],
): RequestInterceptor {
	return async (config) => {
		if (!config.skipAppInitWait) await waitWithSignal(gate.wait(config.signal), config.signal)
		return config
	}
}
