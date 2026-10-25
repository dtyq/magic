import type { LoggerPlugin } from "../types"

export interface FetchPluginOptions {
	shouldReadResponse: (url: URL) => boolean
	isBusinessError: (body: unknown) => boolean
}

/** Observes a detached response clone without changing the application's fetch promise. */
export function createFetchPlugin(options: FetchPluginOptions): LoggerPlugin {
	return {
		name: "fetch",
		scope: "page",
		setup({ logger, onDispose, signal, reportFault }) {
			let active = true
			const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>()
			onDispose(() => {
				active = false
			})
			const original = window.fetch
			async function observe(
				response: Response,
				input: RequestInfo | URL,
				init: RequestInit | undefined,
				started: number,
			) {
				if (!active) return
				const url = new URL(
					input instanceof Request ? input.url : String(input),
					window.location.href,
				)
				if (url.pathname === "/log-report") return
				const headers = new Headers(
					init?.headers ?? (input instanceof Request ? input.headers : undefined),
				)
				const data = {
					url: url.href,
					method: init?.method ?? (input instanceof Request ? input.method : "GET"),
					duration: performance.now() - started,
					status: response.status,
				}
				if (data.duration >= 800) logger.report({ namespace: "slowApi", data })
				if (!response.ok) logger.report({ namespace: "apiError", data })
				if (
					!options.shouldReadResponse(url) ||
					headers.get("accept")?.includes("text/event-stream") ||
					!response.headers.get("content-type")?.includes("application/json") ||
					response.headers.has("content-disposition")
				)
					return
				if (Number(response.headers.get("content-length")) > 64 * 1024) return
				const reader = response.clone().body?.getReader()
				if (!reader) return
				readers.add(reader)
				let expired = false
				const timer = setTimeout(() => {
					expired = true
					void reader.cancel().catch(() => {})
				}, 200)
				try {
					let size = 0
					const chunks: Uint8Array[] = []
					while (active && !expired) {
						const { value, done } = await reader.read()
						if (done) break
						size += value.byteLength
						if (size > 64 * 1024) return
						chunks.push(value)
					}
					if (!active || expired) return
					const bytes = new Uint8Array(size)
					let offset = 0
					chunks.forEach((chunk) => {
						bytes.set(chunk, offset)
						offset += chunk.byteLength
					})
					const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
					if (options.isBusinessError(body))
						logger.report({ namespace: "apiError", data: { ...data, response: body } })
				} finally {
					clearTimeout(timer)
					readers.delete(reader)
					void reader.cancel().catch(() => {})
				}
			}
			const wrapped: typeof fetch = function (this: Window, input, init) {
				const started = performance.now()
				const promise = original.call(this, input, init)
				// Observation is detached: the original promise, rejection and body remain untouched.
				void promise
					.then(
						(response) => observe(response, input, init, started),
						(reason) => {
							if (active)
								logger.report({
									namespace: "apiError",
									data: {
										reason,
										url: input instanceof Request ? input.url : String(input),
									},
								})
						},
					)
					.catch(() => {
						if (!signal.aborted) reportFault()
					})
				return promise
			}
			window.fetch = wrapped
			onDispose(() => {
				if (window.fetch === wrapped) window.fetch = original
				readers.forEach((reader) => {
					void reader.cancel().catch(() => {})
				})
				readers.clear()
			})
		},
	}
}
