interface WorkerRequest {
	id: string
	url: string
}

interface WorkerResponse {
	id: string
	dataUrl?: string
	error?: string
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	const CHUNK = 32768
	let binary = ""
	for (let i = 0; i < bytes.length; i += CHUNK)
		binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
	return btoa(binary)
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
	const { id, url } = event.data
	try {
		const res = await fetch(url)
		if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
		const buffer = await res.arrayBuffer()
		const type = res.headers.get("content-type") ?? "application/octet-stream"
		const base64 = arrayBufferToBase64(buffer)
		const dataUrl = `data:${type};base64,${base64}`;
		(self as unknown as Worker).postMessage({ id, dataUrl } satisfies WorkerResponse)
	} catch (e) {
		(self as unknown as Worker).postMessage({ id, error: String(e) } satisfies WorkerResponse)
	}
}
