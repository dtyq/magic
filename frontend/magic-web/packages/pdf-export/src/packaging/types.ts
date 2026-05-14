import type { CapturedPage } from "../capture/pageCapture"

export interface PackagePdfInput {
	pages: (CapturedPage & { widthMm: number; heightMm: number })[]
	pageSize: {
		width: number
		height: number
	}
	/** 为 true 时每页使用自己的 widthMm/heightMm 作为 PDF 页面尺寸，忽略 pageSize */
	usePerPageSize?: boolean
}

export interface PackagePdfWorkerRequest {
	type: "package"
	payload: PackagePdfInput
}

export type PackagePdfWorkerResponse =
	| {
			type: "success"
			buffer: ArrayBuffer
	  }
	| {
			type: "error"
			error: string
	  }
