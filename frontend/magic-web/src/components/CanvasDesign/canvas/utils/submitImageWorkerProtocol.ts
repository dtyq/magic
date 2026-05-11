import type { CropConfig } from "../types"

export interface SubmitImageRect {
	x: number
	y: number
	width: number
	height: number
}

export interface SubmitImageElementSize {
	width?: number
	height?: number
}

export interface SubmitImageSourceDimensions {
	width: number
	height: number
}

export interface FlattenedEraserStrokes {
	meta: Uint32Array
	points: Float32Array
}

export interface SubmitImageWorkerEraseRequest {
	type: "erase"
	requestId: string
	crop?: CropConfig
	elementSize: SubmitImageElementSize
	sourceDimensions?: SubmitImageSourceDimensions
	ossSrc?: string
	strokes: FlattenedEraserStrokes
}

export interface SubmitImageWorkerExtendRequest {
	type: "extend"
	requestId: string
	crop?: CropConfig
	elementSize: SubmitImageElementSize
	frame: SubmitImageRect
	imageRect: SubmitImageRect
	ossSrc: string
}

export type SubmitImageWorkerRequest =
	| SubmitImageWorkerEraseRequest
	| SubmitImageWorkerExtendRequest

interface SubmitImageWorkerBaseResponse {
	requestId: string
	type: SubmitImageWorkerRequest["type"]
}

export interface SubmitImageWorkerSuccessResponse extends SubmitImageWorkerBaseResponse {
	status: "success"
	sourceDimensions: SubmitImageSourceDimensions
	blob?: Blob
	canvasBlob?: Blob
	markBlob?: Blob
	size?: string
}

export interface SubmitImageWorkerUnsupportedResponse extends SubmitImageWorkerBaseResponse {
	status: "unsupported"
	error: string
}

export interface SubmitImageWorkerErrorResponse extends SubmitImageWorkerBaseResponse {
	status: "error"
	error: string
}

export type SubmitImageWorkerResponse =
	| SubmitImageWorkerSuccessResponse
	| SubmitImageWorkerUnsupportedResponse
	| SubmitImageWorkerErrorResponse

export function getSubmitImageWorkerTransferables(
	request: SubmitImageWorkerRequest,
): Transferable[] {
	if (request.type !== "erase") {
		return []
	}
	return [request.strokes.meta.buffer, request.strokes.points.buffer]
}
