import type { NativeDestroyFn } from "./types"

export type NativeRecordingStatus = "start" | "recording" | "paused" | "published" | "canceled"

export interface NativeRecordingStatusPayload {
	status: NativeRecordingStatus
	interval: number
	volume: number
	workspaceId: string
	projectId: string
	topicId: string
}

export interface NativeRecordingSummaryParams {
	token: string
	organizationCode: string
	userId: string
	workspaceId?: string
	projectId?: string
	topicId?: string
	status: NativeRecordingStatus
	modelId: string
	domain: string
	success?: (data: NativeRecordingStatusPayload) => void
	fail?: () => void
	complete?: () => void
}

export interface NativeRecordingSummaryResult {
	state: number
	data: object
	message: string
}

export interface NativeAIRecordingExistResult {
	isExist: boolean
}

export interface RecordingPort {
	isAIRecordingExist(): Promise<NativeAIRecordingExistResult>
	finishAIRecording(params: { type: "finished" | "stop" }): Promise<unknown>
	nativeRecordingSummary(
		params: NativeRecordingSummaryParams,
	): Promise<NativeRecordingSummaryResult>
	observeRecordingStatusUpdated(
		callback: (payload: NativeRecordingStatusPayload) => unknown,
		uniqueId?: string,
	): NativeDestroyFn | undefined
	getCurrentRecordingStatus(): Promise<NativeRecordingStatusPayload>
}
