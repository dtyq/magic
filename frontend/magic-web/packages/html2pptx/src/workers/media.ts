interface WorkerResponse {
	id: string
	dataUrl?: string
	error?: string
}

type PendingEntry = { resolve: (v: string) => void; reject: (e: Error) => void }

let _worker: Worker | null = null
let _counter = 0
const _pending = new Map<string, PendingEntry>()

function getWorker(): Worker {
	if (_worker) return _worker
	_worker = new Worker(new URL("./media-worker.ts", import.meta.url), { type: "module" })
	_worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
		const { id, dataUrl, error } = event.data
		const entry = _pending.get(id)
		if (!entry) return
		_pending.delete(id)
		if (error) entry.reject(new Error(error))
		else if (dataUrl) entry.resolve(dataUrl)
		else entry.reject(new Error("Worker returned empty response"))
	}
	_worker.onerror = (event) => {
		const err = new Error(`Media worker error: ${event.message}`)
		for (const entry of _pending.values()) entry.reject(err)
		_pending.clear()
		_worker?.terminate()
		_worker = null
	}
	return _worker
}

export function mediaToBase64(url: string, signal?: AbortSignal): Promise<string> {
	if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"))

	const id = String(_counter++)
	const worker = getWorker()

	return new Promise((resolve, reject) => {
		_pending.set(id, { resolve, reject })

		const onAbort = () => {
			if (_pending.has(id)) {
				_pending.delete(id)
				reject(new DOMException("Aborted", "AbortError"))
			}
		}
		signal?.addEventListener("abort", onAbort, { once: true })

		worker.postMessage({ id, url })
	})
}
