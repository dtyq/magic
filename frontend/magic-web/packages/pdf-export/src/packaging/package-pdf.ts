import { log, LogLevel } from "../logger"
import { createAbortError } from "../sandbox/abort"
import type {
	PackagePdfInput,
	PackagePdfWorkerRequest,
	PackagePdfWorkerResponse,
} from "./types"

export async function packagePdfInWorker({
	pages,
	pageSize,
	usePerPageSize,
	signal,
}: PackagePdfInput & {
	signal: AbortSignal
}): Promise<ArrayBuffer> {
	const worker = new Worker(new URL("./package-pdf.worker.ts", import.meta.url), {
		type: "module",
	})

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

		worker.onmessage = (event: MessageEvent<PackagePdfWorkerResponse>) => {
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
			reject(new Error(`PDF packaging worker failed: ${event.message}`))
		}

		signal.addEventListener("abort", onAbort, { once: true })

		const request: PackagePdfWorkerRequest = {
			type: "package",
			payload: {
				pageSize,
				pages,
				usePerPageSize,
			},
		}
		const transferList = pages.map((page) => page.imageBytes)
		log(LogLevel.L2, "Start PDF packaging in Worker", { pageCount: pages.length })
		worker.postMessage(request, transferList)
	})
}
