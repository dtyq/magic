import type { StreamingOutputSink, StreamingPackagingWorkerResponse } from "./streaming-types"

const DEFAULT_ACK_WINDOW = 2

export interface SinkChunkTransport {
	postMessage(message: StreamingPackagingWorkerResponse, transfer?: Transferable[]): void
}

export interface SinkProxyWritable {
	readonly writable: WritableStream<Uint8Array>
	acknowledge(chunkId: number): void
	abort(reason?: unknown): Promise<void>
}

/** Expose any destination sink through the standard stream contract used by PptxGenJS. */
export function createSinkWritableStream(sink: StreamingOutputSink): WritableStream<Uint8Array> {
	return new WritableStream<Uint8Array>({
		write: (chunk) => sink.write(chunk),
		close: () => sink.close(),
		abort: (reason) => sink.abort?.(reason),
	})
}

/**
 * Create the Worker side of the fallback output bridge.  Each transferred
 * chunk retains one promise until the main thread has durably written it and
 * returned `sink-ack`; the small window bounds detached-but-unacknowledged data.
 */
export function createSinkProxyWritable({
	transport,
	ackWindow = DEFAULT_ACK_WINDOW,
}: {
	transport: SinkChunkTransport
	ackWindow?: number
}): SinkProxyWritable {
	if (!Number.isSafeInteger(ackWindow) || ackWindow < 1) {
		throw new RangeError("Packaging sink ACK window must be a positive safe integer")
	}

	let nextChunkId = 1
	let terminalError: Error | null = null
	const acknowledgements = new Map<
		number,
		{ promise: Promise<void>; resolve: () => void; reject: (error: Error) => void }
	>()
	const capacityWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = []

	const rejectIfTerminal = () => {
		if (terminalError) throw terminalError
	}

	const wakeCapacityWaiter = () => {
		if (acknowledgements.size >= ackWindow) return
		capacityWaiters.shift()?.resolve()
	}

	const waitForCapacity = async () => {
		rejectIfTerminal()
		if (acknowledgements.size < ackWindow) return
		await new Promise<void>((resolve, reject) => {
			capacityWaiters.push({ resolve, reject })
		})
		rejectIfTerminal()
	}

	const fail = (reason?: unknown) => {
		if (terminalError) return terminalError
		terminalError = toError(reason ?? "Packaging sink proxy was aborted")
		for (const pending of acknowledgements.values()) pending.reject(terminalError)
		acknowledgements.clear()
		for (const waiter of capacityWaiters.splice(0)) waiter.reject(terminalError)
		return terminalError
	}

	const writable = new WritableStream<Uint8Array>({
		async write(chunk) {
			await waitForCapacity()
			rejectIfTerminal()
			const chunkId = nextChunkId++
			// Own exactly this view before transfer. Transferring a larger backing buffer
			// would retain unrelated bytes and could detach data still used by the writer.
			const data = chunk.buffer.slice(
				chunk.byteOffset,
				chunk.byteOffset + chunk.byteLength,
			) as ArrayBuffer
			let resolveAcknowledgement!: () => void
			let rejectAcknowledgement!: (error: Error) => void
			const promise = new Promise<void>((resolve, reject) => {
				resolveAcknowledgement = resolve
				rejectAcknowledgement = reject
			})
			// `WritableStream.write()` intentionally resolves before ACK so the window
			// can contain multiple chunks. Mark the internal promise as handled; close()
			// still observes the original rejection when it waits for outstanding ACKs.
			void promise.catch(() => undefined)
			acknowledgements.set(chunkId, {
				promise,
				resolve: resolveAcknowledgement,
				reject: rejectAcknowledgement,
			})
			try {
				transport.postMessage({ type: "sink-chunk", chunkId, data }, [data])
			} catch (error) {
				acknowledgements.delete(chunkId)
				wakeCapacityWaiter()
				throw fail(error)
			}
			// Returning here lets the ZIP writer produce up to ackWindow chunks.
			// The capacity gate above blocks the next write once the window is full.
		},
		async close() {
			rejectIfTerminal()
			await Promise.all(Array.from(acknowledgements.values(), ({ promise }) => promise))
			rejectIfTerminal()
		},
		abort(reason) {
			fail(reason)
		},
	})

	return {
		writable,
		acknowledge(chunkId) {
			const pending = acknowledgements.get(chunkId)
			if (!pending) return
			acknowledgements.delete(chunkId)
			pending.resolve()
			wakeCapacityWaiter()
		},
		async abort(reason) {
			fail(reason)
			try {
				await writable.abort(terminalError)
			} catch {
				// Pending writes already received the same terminal error above.
			}
		},
	}
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error))
}
