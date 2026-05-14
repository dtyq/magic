import { log, LogLevel } from "../logger"
import { createAbortError } from "../sandbox/abort"
import type {
	PackageImagesWorkerRequest,
	PackageImagesWorkerResponse,
} from "./package-images.worker"

export interface PackageImagesInput {
	files: { name: string; buffer: ArrayBuffer }[]
	zipFileName: string
}

export async function packageImagesInWorker({
	files,
	zipFileName,
	signal,
}: PackageImagesInput & { signal: AbortSignal }): Promise<ArrayBuffer> {
	const worker = new Worker(
		new URL("./package-images.worker.ts", import.meta.url),
		{ type: "module" },
	)

	return new Promise<ArrayBuffer>((resolve, reject) => {
		const cleanup = () => {
			signal.removeEventListener("abort", onAbort)
			worker.onmessage = null
			worker.onerror = null
		}

		const onAbort = () => {
			cleanup()
			worker.terminate()
			reject(createAbortError())
		}

		worker.onmessage = (event: MessageEvent<PackageImagesWorkerResponse>) => {
			cleanup()
			const response = event.data
			worker.terminate()
			if (response.type === "error") {
				reject(new Error(response.error))
				return
			}
			resolve(response.buffer)
		}

		worker.onerror = (event) => {
			cleanup()
			worker.terminate()
			reject(new Error(`Image packaging worker failed: ${event.message}`))
		}

		signal.addEventListener("abort", onAbort, { once: true })

		const request: PackageImagesWorkerRequest = {
			type: "package",
			payload: { files, zipFileName },
		}
		const transferList = files.map((f) => f.buffer)
		log(LogLevel.L2, "Start image ZIP packaging in Worker", { fileCount: files.length })
		worker.postMessage(request, transferList)
	})
}
