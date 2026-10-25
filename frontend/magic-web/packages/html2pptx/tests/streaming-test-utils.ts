/**
 * Collect a v5 destination-first PPTX stream for XML assertions without using
 * the removed buffered-output API.
 */
export function createCollectingPptxDestination(): {
	destination: WritableStream<Uint8Array>
	chunks: Uint8Array[]
} {
	const chunks: Uint8Array[] = []
	const destination = new WritableStream<Uint8Array>({
		write(chunk) {
			chunks.push(chunk.slice())
		},
	})
	return { destination, chunks }
}

export function concatPptxChunks(chunks: readonly Uint8Array[]): Uint8Array {
	const totalBytes = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
	const output = new Uint8Array(totalBytes)
	let offset = 0
	for (const chunk of chunks) {
		output.set(chunk, offset)
		offset += chunk.byteLength
	}
	return output
}

export interface StreamingPptxPresentation {
	writeTo(options: {
		destination: WritableStream<Uint8Array>
	}): Promise<unknown>
}

export function asStreamingPptxPresentation(value: unknown): StreamingPptxPresentation {
	return value as StreamingPptxPresentation
}
