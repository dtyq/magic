import type { UploadResponse } from "../../types"

export interface FileDataPrevious {
	id: string
	name: string
	file_id: string
	file: null
	size: number
	status: "done"
	progress: 100
	result: UploadResponse
	error?: Error
	cancel?: () => void
}

export interface FileDataNormal {
	id: string
	name: string
	file: File | null
	size: number
	status: "init" | "uploading" | "done" | "error"
	progress: number
	result?: UploadResponse
	error?: Error
	cancel?: () => void
}

export type FileData = FileDataNormal | FileDataPrevious
