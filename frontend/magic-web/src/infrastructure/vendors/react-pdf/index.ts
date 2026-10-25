import { getPackageAssetUrl } from "@/utils/packageAsset"

let pdfWorkerBlobUrlPromise: Promise<string> | null = null
let reactPdfModulePromise: Promise<typeof import("react-pdf")> | null = null

const loadPdfWorkerBlobUrl = (workerUrl: string): Promise<string> => {
	if (!pdfWorkerBlobUrlPromise) {
		pdfWorkerBlobUrlPromise = fetch(workerUrl)
			.then((response) => {
				if (!response.ok) {
					throw new Error(`Failed to load PDF worker: ${response.status}`)
				}
				return response.text()
			})
			.then((workerCode) =>
				URL.createObjectURL(
					new Blob([workerCode], {
						type: "text/javascript",
					}),
				),
			)
			.catch((error) => {
				pdfWorkerBlobUrlPromise = null
				throw error
			})
	}

	return pdfWorkerBlobUrlPromise
}

export type { DocumentProps, PageProps } from "react-pdf"

/**
 * Load the complete React-PDF module once. Consumers must render Document/Page
 * from this resolved module rather than importing them statically; otherwise
 * the same runtime enters both the initial and async dependency graphs.
 */
export const loadReactPdf = (): Promise<typeof import("react-pdf")> => {
	if (!reactPdfModulePromise) {
		reactPdfModulePromise = import("react-pdf")
			.then(async (module) => {
				if (module.pdfjs?.GlobalWorkerOptions) {
					const workerUrl = getPackageAssetUrl("pdfjs/pdf.worker.min.mjs")
					module.pdfjs.GlobalWorkerOptions.workerSrc =
						await loadPdfWorkerBlobUrl(workerUrl)
				}
				return module
			})
			.catch((error) => {
				reactPdfModulePromise = null
				throw error
			})
	}

	return reactPdfModulePromise
}

export default loadReactPdf
