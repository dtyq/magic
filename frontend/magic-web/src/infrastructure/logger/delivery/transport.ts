import { normalLimits } from "../limits"
export interface EncodedBatch {
	body: Uint8Array<ArrayBuffer>
	encoding?: "gzip"
}
export interface DeliveryResult {
	ok: boolean
	reason?: string
	retryable?: boolean
	retryAfterMs?: number
}

export type CompressionFallbackReason = "gzip_unavailable" | "gzip_failed" | "gzip_capacity"

export async function encodeBatch(
	json: string,
	onFallback: (reason: CompressionFallbackReason) => void = () => undefined,
): Promise<EncodedBatch> {
	const body = new TextEncoder().encode(json)
	// Check before compression: a small gzip must not bypass the decoded request limit.
	if (body.byteLength > normalLimits.batchBytes) throw new Error("log_batch_capacity")
	if (typeof CompressionStream === "undefined") {
		onFallback("gzip_unavailable")
		return { body }
	}
	try {
		const stream = new Blob([body]).stream().pipeThrough(new CompressionStream("gzip"))
		const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
		// Prefer gzip even for tiny batches. Expansion must still respect the receiver's
		// wire limit; the already checked JSON remains a valid fallback in that case.
		if (compressed.byteLength > normalLimits.batchBytes) {
			onFallback("gzip_capacity")
			return { body }
		}
		return { body: compressed, encoding: "gzip" }
	} catch {
		onFallback("gzip_failed")
		return { body }
	}
}

// Browser keepalive capacity is shared by all logger instances in this page/realm.
// Reserve before awaiting fetch and release in finally, including abort and shutdown.
let pageKeepaliveBytes = 0

export class FetchTransport {
	private controllers = new Set<AbortController>()
	private closed = false
	constructor(
		private fetcher: typeof fetch,
		private endpoint = "/log-report",
	) {}
	async send(
		batch: EncodedBatch,
		count: number,
		options: {
			timeoutMs?: number
			keepalive?: boolean
			signal?: AbortSignal
		} = {},
	): Promise<DeliveryResult> {
		if (this.closed || options.signal?.aborted) return { ok: false, reason: "cancelled" }
		if (batch.body.byteLength > normalLimits.batchBytes)
			return { ok: false, reason: "batch_capacity", retryable: false }
		const keepalive = options.keepalive ?? false
		if (keepalive && pageKeepaliveBytes + batch.body.byteLength > normalLimits.keepaliveBytes)
			return { ok: false, reason: "keepalive_budget" }
		const controller = new AbortController()
		const cancel = () => controller.abort()
		options.signal?.addEventListener("abort", cancel, { once: true })
		this.controllers.add(controller)
		if (keepalive) pageKeepaliveBytes += batch.body.byteLength
		const timer = setTimeout(cancel, options.timeoutMs ?? normalLimits.timeoutMs)
		try {
			const response = await this.fetcher(this.endpoint, {
				method: "POST",
				body: batch.body,
				signal: controller.signal,
				keepalive,
				headers: {
					"Content-Type": "application/json",
					...(batch.encoding ? { "Content-Encoding": batch.encoding } : {}),
				},
			})
			if (!response.ok) {
				const retry = response.headers.get("Retry-After")
				const retryAfterMs = retry
					? Math.max(
							0,
							/^\d+$/.test(retry)
								? Number(retry) * 1000
								: Date.parse(retry) - Date.now(),
						)
					: undefined
				return {
					ok: false,
					reason: `http_${response.status}`,
					retryable: response.status === 429 || response.status >= 500,
					retryAfterMs,
				}
			}
			// A proxy HTML page or an old receiver's 200 is not an acknowledgement.
			const reader = response.body?.getReader()
			if (!reader) return { ok: false, reason: "invalid_receipt" }
			let text = ""
			let bytes = 0
			const decoder = new TextDecoder()
			try {
				for (;;) {
					const { value, done } = await reader.read()
					if (done) break
					bytes += value.byteLength
					if (bytes > 4096) return { ok: false, reason: "invalid_receipt" }
					text += decoder.decode(value, { stream: true })
				}
				text += decoder.decode()
			} finally {
				void reader.cancel().catch(() => {})
			}
			const receipt = JSON.parse(text) as { code?: number; accepted?: number }
			return receipt.code === 1000 && receipt.accepted === count
				? { ok: true }
				: { ok: false, reason: "invalid_receipt" }
		} catch (error) {
			return {
				ok: false,
				reason:
					error instanceof SyntaxError
						? "invalid_receipt"
						: controller.signal.aborted
							? "timeout"
							: "network",
				retryable:
					!(error instanceof SyntaxError) && !this.closed && !options.signal?.aborted,
			}
		} finally {
			clearTimeout(timer)
			options.signal?.removeEventListener("abort", cancel)
			this.controllers.delete(controller)
			if (keepalive) pageKeepaliveBytes -= batch.body.byteLength
		}
	}
	destroy() {
		this.closed = true
		this.controllers.forEach((controller) => controller.abort())
		this.controllers.clear()
	}
}
