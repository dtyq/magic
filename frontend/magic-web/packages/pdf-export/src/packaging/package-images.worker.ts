import JSZip from "jszip"

export interface PackageImagesWorkerRequest {
	type: "package"
	payload: {
		files: { name: string; buffer: ArrayBuffer }[]
		zipFileName: string
	}
}

export type PackageImagesWorkerResponse =
	| { type: "success"; buffer: ArrayBuffer }
	| { type: "error"; error: string }

self.onmessage = async (event: MessageEvent<PackageImagesWorkerRequest>) => {
	const request = event.data
	if (request.type !== "package") return

	try {
		const { files } = request.payload
		const zip = new JSZip()
		for (const file of files) {
			zip.file(file.name, file.buffer)
		}
		const buffer = await zip.generateAsync({ type: "arraybuffer" })
		;(self as unknown as Worker).postMessage(
			{ type: "success", buffer } satisfies PackageImagesWorkerResponse,
			[buffer],
		)
	} catch (error) {
		;(self as unknown as Worker).postMessage({
			type: "error",
			error: error instanceof Error ? error.message : String(error),
		} satisfies PackageImagesWorkerResponse)
	}
}
