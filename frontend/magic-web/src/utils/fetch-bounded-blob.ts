export interface FetchBoundedBlobOptions {
	maxBytes: number
	signal?: AbortSignal
	cache?: RequestCache
}

export type BoundedBlobResult = { status: "complete"; blob: Blob } | { status: "too-large" }

/** 完整文件才可预览；上限约束保留的字节量，超限立即取消，不能退回无界下载。 */
export async function fetchBoundedBlob(
	url: string,
	{ maxBytes, signal, cache }: FetchBoundedBlobOptions,
): Promise<BoundedBlobResult> {
	if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
		throw new RangeError("maxBytes must be a positive safe integer")
	}

	const controller = new AbortController()
	const abort = () => controller.abort()
	signal?.addEventListener("abort", abort, { once: true })
	if (signal?.aborted) abort()
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
	let complete = false

	try {
		const response = await fetch(url, { signal: controller.signal, cache })
		if (!response.ok || response.status === 206 || response.headers.has("content-range")) {
			throw new Error(`File request did not return a complete response: ${response.status}`)
		}

		const lengthHeader = response.headers.get("content-length")
		const contentLength =
			lengthHeader !== null && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : undefined
		if (contentLength !== undefined && contentLength > maxBytes) {
			return { status: "too-large" }
		}
		if (!response.body) throw new Error("Streaming file reads are unavailable")

		reader = response.body.getReader()
		const chunks: ArrayBuffer[] = []
		let totalBytes = 0
		while (!complete) {
			const { done, value } = await reader.read()
			if (controller.signal.aborted) {
				throw new DOMException("File read cancelled", "AbortError")
			}
			complete = done
			if (done) continue
			totalBytes += value.byteLength
			if (totalBytes > maxBytes) return { status: "too-large" }
			chunks.push(new Uint8Array(value).buffer)
		}

		// 必须读到 EOF；Content-Length 只作上限预判。
		// 浏览器可能已解压正文，且跨域时未暴露 Content-Encoding，不能比较两种字节口径。
		return {
			status: "complete",
			blob: new Blob(chunks, { type: response.headers.get("content-type") || "" }),
		}
	} finally {
		signal?.removeEventListener("abort", abort)
		if (!complete) {
			controller.abort()
			await reader?.cancel().catch(() => undefined)
		}
		reader?.releaseLock()
	}
}
