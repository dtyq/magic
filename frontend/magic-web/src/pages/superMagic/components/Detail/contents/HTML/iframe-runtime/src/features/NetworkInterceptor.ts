/**
 * NetworkInterceptor
 * Monkey-patches fetch and XMLHttpRequest to capture network requests,
 * collects entries in a ring buffer, and notifies listeners.
 */

export interface NetworkEntry {
	id: string
	method: string
	url: string
	status: number
	statusText: string
	duration: number
	requestHeaders: Record<string, string>
	requestBody: string | null
	responseHeaders: Record<string, string>
	/** Truncated to MAX_BODY_SIZE */
	responseBody: string | null
	startTime: number
	endTime: number
	error?: string
}

type NetworkEntryListener = (entry: NetworkEntry) => void

const MAX_ENTRIES = 200
const MAX_BODY_SIZE = 10 * 1024 // 10KB

export class NetworkInterceptor {
	private enabled = false
	private entries: NetworkEntry[] = []
	private listener: NetworkEntryListener | null = null

	private originalFetch: typeof window.fetch | null = null
	private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null
	private originalXHRSend: typeof XMLHttpRequest.prototype.send | null = null

	enable(): void {
		if (this.enabled) return
		this.enabled = true
		this.patchFetch()
		this.patchXHR()
	}

	disable(): void {
		if (!this.enabled) return
		this.enabled = false
		this.restoreFetch()
		this.restoreXHR()
	}

	onEntry(listener: NetworkEntryListener): void {
		this.listener = listener
	}

	getEntries(): NetworkEntry[] {
		return [...this.entries]
	}

	clear(): void {
		this.entries = []
	}

	// ─── Fetch Patching ──────────────────────────────────────────────────────

	private patchFetch(): void {
		this.originalFetch = window.fetch.bind(window)

		window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
			const startTime = Date.now()
			const method = (init?.method ?? "GET").toUpperCase()
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.href : input.url
			const requestHeaders = this.extractHeaders(init?.headers)
			const requestBody = this.bodyToString(init?.body)
			const id = `n_${startTime}_${Math.random().toString(36).slice(2, 8)}`

			try {
				const response = await this.originalFetch!(input, init)
				const endTime = Date.now()

				// Clone response so we can read the body without consuming it
				const clone = response.clone()
				let responseBody: string | null = null
				try {
					const text = await clone.text()
					responseBody = this.truncate(text)
				} catch {
					responseBody = "[Failed to read response body]"
				}

				const entry: NetworkEntry = {
					id,
					method,
					url,
					status: response.status,
					statusText: response.statusText,
					duration: endTime - startTime,
					requestHeaders,
					requestBody,
					responseHeaders: this.responseHeadersToRecord(response.headers),
					responseBody,
					startTime,
					endTime,
				}
				this.pushEntry(entry)

				return response
			} catch (err) {
				const endTime = Date.now()
				const entry: NetworkEntry = {
					id,
					method,
					url,
					status: 0,
					statusText: "",
					duration: endTime - startTime,
					requestHeaders,
					requestBody,
					responseHeaders: {},
					responseBody: null,
					startTime,
					endTime,
					error: err instanceof Error ? err.message : String(err),
				}
				this.pushEntry(entry)
				throw err
			}
		}
	}

	private restoreFetch(): void {
		if (this.originalFetch) {
			window.fetch = this.originalFetch
			this.originalFetch = null
		}
	}

	// ─── XHR Patching ────────────────────────────────────────────────────────

	private patchXHR(): void {
		const originalOpen = (this.originalXHROpen = XMLHttpRequest.prototype.open)
		const originalSend = (this.originalXHRSend = XMLHttpRequest.prototype.send)
		const bodyToString = (body: Parameters<NetworkInterceptor["bodyToString"]>[0]) =>
			this.bodyToString(body)
		const truncate = (str: string) => this.truncate(str)
		const pushEntry = (entry: NetworkEntry) => this.pushEntry(entry)

		XMLHttpRequest.prototype.open = function (
			this: XMLHttpRequest,
			method: string,
			url: string | URL,
			...rest: unknown[]
		) {
			const meta = this as unknown as Record<string, unknown>
			meta.__dt_method = method.toUpperCase()
			meta.__dt_url = typeof url === "string" ? url : url.href
			meta.__dt_headers = {} as Record<string, string>

			// Patch setRequestHeader to capture headers
			const origSetHeader = this.setRequestHeader.bind(this)
			this.setRequestHeader = (name: string, value: string) => {
				;(meta.__dt_headers as Record<string, string>)[name] = value
				origSetHeader(name, value)
			}

			return originalOpen.call(this, method, url, ...(rest as [boolean, string?, string?]))
		}

		XMLHttpRequest.prototype.send = function (
			this: XMLHttpRequest,
			body?: Document | XMLHttpRequestBodyInit | null,
		) {
			const meta = this as unknown as Record<string, unknown>
			const startTime = Date.now()
			const id = `n_${startTime}_${Math.random().toString(36).slice(2, 8)}`
			const requestBody = bodyToString(body)

			const handleDone = () => {
				const endTime = Date.now()
				const responseHeaders: Record<string, string> = {}
				try {
					const raw = this.getAllResponseHeaders()
					raw.split("\r\n").forEach((line) => {
						const idx = line.indexOf(":")
						if (idx > 0) {
							responseHeaders[line.slice(0, idx).trim().toLowerCase()] = line
								.slice(idx + 1)
								.trim()
						}
					})
				} catch {
					// ignore
				}

				let responseBody: string | null = null
				try {
					responseBody = truncate(
						typeof this.response === "string" ? this.response : this.responseText,
					)
				} catch {
					responseBody = "[Failed to read response body]"
				}

				const entry: NetworkEntry = {
					id,
					method: (meta.__dt_method as string) ?? "GET",
					url: (meta.__dt_url as string) ?? "",
					status: this.status,
					statusText: this.statusText,
					duration: endTime - startTime,
					requestHeaders: (meta.__dt_headers as Record<string, string>) ?? {},
					requestBody,
					responseHeaders,
					responseBody,
					startTime,
					endTime,
					error: this.status === 0 ? "Network error" : undefined,
				}
				pushEntry(entry)
			}

			this.addEventListener("loadend", handleDone, { once: true })

			return originalSend.call(this, body)
		}
	}

	private restoreXHR(): void {
		if (this.originalXHROpen) {
			XMLHttpRequest.prototype.open = this.originalXHROpen
			this.originalXHROpen = null
		}
		if (this.originalXHRSend) {
			XMLHttpRequest.prototype.send = this.originalXHRSend
			this.originalXHRSend = null
		}
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────

	private pushEntry(entry: NetworkEntry): void {
		this.entries.push(entry)
		if (this.entries.length > MAX_ENTRIES) {
			this.entries = this.entries.slice(-MAX_ENTRIES)
		}
		this.listener?.(entry)
	}

	private extractHeaders(headers?: HeadersInit): Record<string, string> {
		const result: Record<string, string> = {}
		if (!headers) return result
		if (headers instanceof Headers) {
			headers.forEach((value, key) => {
				result[key] = value
			})
		} else if (Array.isArray(headers)) {
			headers.forEach(([key, value]) => {
				result[key] = value
			})
		} else {
			Object.entries(headers).forEach(([key, value]) => {
				result[key] = value
			})
		}
		return result
	}

	private responseHeadersToRecord(headers: Headers): Record<string, string> {
		const result: Record<string, string> = {}
		headers.forEach((value, key) => {
			result[key] = value
		})
		return result
	}

	private bodyToString(body: unknown): string | null {
		if (body == null) return null
		if (typeof body === "string") return this.truncate(body)
		if (body instanceof URLSearchParams) return this.truncate(body.toString())
		if (body instanceof FormData) {
			const parts: string[] = []
			body.forEach((value, key) => {
				parts.push(
					`${key}=${value instanceof File ? `[File: ${value.name}]` : String(value)}`,
				)
			})
			return this.truncate(parts.join("&"))
		}
		if (body instanceof ArrayBuffer || body instanceof Blob) {
			return `[Binary: ${(body as Blob).size ?? (body as ArrayBuffer).byteLength} bytes]`
		}
		try {
			return this.truncate(JSON.stringify(body))
		} catch {
			return String(body)
		}
	}

	private truncate(value: string): string {
		if (value.length > MAX_BODY_SIZE) {
			return value.slice(0, MAX_BODY_SIZE) + `... [truncated, total ${value.length} bytes]`
		}
		return value
	}
}
