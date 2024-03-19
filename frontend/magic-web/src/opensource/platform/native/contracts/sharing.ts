import type { NativeDestroyFn } from "./types"

export type NativeSharedDataType = 1 | 2
export type NativeStreamStatus = 0 | 1 | 2 | 3

export interface NativeSharedStreamData {
	file_index: number
	file_path: string
	stream_status: NativeStreamStatus
	base64_data?: string
	chunk_id: number
}

export interface NativeSharedDataPayload {
	project_mode?: string
	type: NativeSharedDataType
	content?: string
	file_paths?: string[]
	stream?: NativeSharedStreamData
}

export interface SharingPort {
	observeReceivedSharedData(
		callback: (payload: NativeSharedDataPayload) => void,
	): NativeDestroyFn | undefined
	readyForSuperMagic(params?: Record<string, unknown>): Promise<void>
}
