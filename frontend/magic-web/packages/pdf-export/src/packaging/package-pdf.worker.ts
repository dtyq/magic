import { jsPDF } from "jspdf"
import type { PackagePdfWorkerRequest } from "./types"

self.onmessage = async (event: MessageEvent<PackagePdfWorkerRequest>) => {
	const request = event.data
	if (request.type !== "package") return

	try {
		const { pages, pageSize, usePerPageSize } = request.payload
		const firstPageSize = usePerPageSize && pages.length > 0
			? { width: pages[0].widthMm, height: pages[0].heightMm }
			: pageSize
		const doc = new jsPDF({
			unit: "mm",
			format: [firstPageSize.width, firstPageSize.height],
			orientation: firstPageSize.width > firstPageSize.height ? "landscape" : "portrait",
			compress: true,
		})

		for (let index = 0; index < pages.length; index++) {
			const page = pages[index]
			if (index > 0) {
				const w = usePerPageSize ? page.widthMm : pageSize.width
				const h = usePerPageSize ? page.heightMm : pageSize.height
				doc.addPage([w, h])
			}
			const format = page.imageType === "jpeg" ? "JPEG" : "PNG"
			doc.addImage(
				new Uint8Array(page.imageBytes),
				format,
				0,
				0,
				page.widthMm,
				page.heightMm,
			)
		}

		const buffer = doc.output("arraybuffer")
		;(self as unknown as Worker).postMessage({ type: "success", buffer }, [buffer])
	} catch (error) {
		;(self as unknown as Worker).postMessage({
			type: "error",
			error: error instanceof Error ? error.message : String(error),
		})
	}
}
