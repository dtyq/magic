import type { PptxOutputSink } from "../api/options"

export const PPTX_MIME_TYPE =
	"application/vnd.openxmlformats-officedocument.presentationml.presentation"

export interface BufferedPptxSink {
	sink: PptxOutputSink
	/** Return the completed PPTX as a Blob after `sink.close()` resolves. */
	getBlob: () => Blob
	getBytesWritten: () => number
}

/**
 * Create a generic client-side sink for environments without a writable file handle.
 * The streaming pipeline still applies backpressure at the sink boundary; only the final
 * destination is buffered in memory for a Blob download.
 */
export function createBufferedPptxSink(contentType = PPTX_MIME_TYPE): BufferedPptxSink {
	// Allocate owned ArrayBuffers so Blob construction is compatible with the current DOM
	// typings, which reject Uint8Array<ArrayBufferLike> because it may reference SharedArrayBuffer.
	let chunks: ArrayBuffer[] = []
	let bytesWritten = 0
	let state: "open" | "closed" | "aborted" = "open"

	const sink: PptxOutputSink = {
		write: async (chunk) => {
			if (state !== "open") throw new Error("PPTX buffered sink is already closed")
			const copy = new Uint8Array(chunk.byteLength)
			copy.set(chunk)
			chunks.push(copy.buffer)
			bytesWritten += copy.byteLength
		},
		close: () => {
			if (state === "aborted") throw new Error("PPTX buffered sink was aborted")
			state = "closed"
		},
		abort: () => {
			if (state === "closed") return
			state = "aborted"
			chunks = []
			bytesWritten = 0
		},
	}

	return {
		sink,
		getBlob: () => {
			if (state !== "closed") throw new Error("PPTX buffered sink is not closed")
			const blob = new Blob(chunks, { type: contentType })
			chunks = []
			return blob
		},
		getBytesWritten: () => bytesWritten,
	}
}
