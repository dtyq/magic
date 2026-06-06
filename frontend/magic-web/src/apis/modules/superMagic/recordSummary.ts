import { CHARACTER_COUNT_LIMIT } from "@/components/business/RecordingSummary/const"
import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"
import { UploadConfig as SDKUploadConfig } from "@dtyq/upload-sdk"
import { PresetFile, RecordingDirectory } from "@/types/recordSummary"

export enum RecordingSummaryType {
	FileUpload = "file_upload", // file upload
	FrontendRecording = "frontend_recording", // frontend recording audio generation
}

export enum RecordingSummaryStatus {
	Start = "start",
	Recording = "recording",
	Paused = "paused",
	Stopped = "stopped",
	Canceled = "canceled",
}

export type GetRecordingSummaryResultResponse = {
	success: boolean
	task_key: string
	project_id: string
	chat_topic_id: string
	conversation_id: string
	topic_id: string | undefined
	project_name: string
	workspace_name: string
}

/** Progress payload returned by single/batch ASR task progress endpoints */
export interface RecordTaskProgress {
	exists: boolean
	task_key: string
	project_id?: string
	topic_id?: string | number
	audio_file_id?: string | number
	current_phase?: string
	phase_status?: string
	phase_percent?: number
	phase_error?: string | null
	auto_summary?: boolean
	can_summarize?: boolean
	can_finish_recording?: boolean
	recording_status?: string
	task_status?: string
	duration_seconds?: number
	file_size_bytes?: number
	model_id?: string
}

export interface BatchTaskProgressResponse {
	tasks: RecordTaskProgress[]
}

export interface SummarizeRecordedTaskResponse {
	success: boolean
	message?: string
	task_key: string
	summary?: {
		topic_id?: string
		model_id?: string
		status?: string
	}
}

export const generateRecordingSummaryApi = (fetch: HttpClient) => ({
	/**
	 * @description 获取录音总结上传token
	 * @param task_key 任务key
	 * @param topic_id 话题id
	 * @param type 类型
	 * @returns 录音总结上传token
	 */
	getRecordingSummaryUploadToken({
		task_key,
		topic_id,
		type,
		file_name,
	}: {
		task_key: string
		topic_id: string
		type: RecordingSummaryType
		file_name?: string
	}) {
		return fetch.get<{
			sts_token: SDKUploadConfig["customCredentials"]
			task_key: string
			expires_in: number
			directories: {
				asr_hidden_dir: RecordingDirectory
				asr_display_dir: RecordingDirectory
			}
			sandbox_topic_id: string
			preset_files: {
				note_file: PresetFile
				transcript_file: PresetFile
				marker_file: PresetFile
			}
		}>(genRequestUrl(`/api/v1/asr/upload-tokens`, {}, { task_key, topic_id, type, file_name }))
	},

	/**
	 * @description 报告录音总结状态
	 * @param task_key 任务key
	 * @param status 状态
	 * @param model_id 模型id
	 * @param note 笔记
	 * @param asr_stream_content 录音总结流式内容
	 * @returns 报告录音总结状态结果
	 */
	reportRecordingSummaryStatus({
		task_key,
		status,
		model_id,
		note,
		asr_stream_content,
	}: {
		task_key: string
		status: RecordingSummaryStatus
		// 发起总结时，需要传递以下参数
		model_id?: string
		note?: {
			content: string
			file_extension: string
		}
		asr_stream_content?: string
	}) {
		const limitAsrStreamContent = asr_stream_content?.slice(0, 10000) || ""
		const limitNote = note?.content?.slice(0, CHARACTER_COUNT_LIMIT) || ""

		return fetch.post(`/api/v1/asr/status`, {
			task_key,
			model_id,
			note: {
				content: limitNote,
				file_extension: note?.file_extension || "",
			},
			asr_stream_content: limitAsrStreamContent,
			status,
		})
	},

	/**
	 * @description 获取录音总结结果
	 * @param task_key 任务key
	 * @param project_id 项目id
	 * @param topic_id 话题id
	 * @param model_id 模型id
	 * @param file_id 文件id（上传文件场景）
	 * @param note 笔记（录音场景）
	 * @param asr_stream_content 录音总结流式内容（录音场景）
	 * @returns 录音总结结果
	 */
	getRecordingSummaryResult({
		task_key,
		project_id,
		topic_id,
		model_id,
		file_id,
		note,
		asr_stream_content,
	}: {
		task_key?: string
		project_id: string
		topic_id: string
		model_id: string
		file_id?: string
		note?: {
			content: string
			file_extension: string
		}
		asr_stream_content?: string // 录音总结流式内容，最大不超过 10000 字符
	}) {
		const limitAsrStreamContent = asr_stream_content?.slice(0, 10000) || ""
		const limitNote = note?.content?.slice(0, CHARACTER_COUNT_LIMIT) || ""

		return fetch.post<GetRecordingSummaryResultResponse>(genRequestUrl("/api/v1/asr/summary"), {
			task_key,
			project_id,
			topic_id,
			model_id,
			file_id,
			note: {
				content: limitNote,
				file_extension: note?.file_extension || "",
			},
			asr_stream_content: limitAsrStreamContent,
		})
	},

	/**
	 * @description 下载录音文件
	 * @param task_key 任务key
	 * @returns 录音文件下载url
	 */
	downloadRecording({ task_key }: { task_key: string }) {
		return fetch.get<{
			success: boolean
			task_key: string
			download_url: string
			file_key: string
			message: string
			user: {
				user_id: string
				organization_code: string
			}
		}>(genRequestUrl(`/api/v1/asr/download-url`, {}, { task_key }))
	},

	/**
	 * TODO: 与后端确认这个api 与 getRecordingSummaryResult 的区别，决定是否需要保留
	 * @description Trigger AI summary for a live-recorded task (APP recorded audio)
	 */
	summarizeRecordedTask({
		task_key,
		topic_id,
		model_id,
	}: {
		task_key: string
		topic_id: string
		model_id: string
	}) {
		return fetch.post<SummarizeRecordedTaskResponse>(
			genRequestUrl(`/api/v1/asr/tasks/${encodeURIComponent(task_key)}/summarize`),
			{ topic_id, model_id },
		)
	},

	/**
	 * @description Batch query progress for in-flight ASR summary tasks
	 */
	batchTaskProgress({ task_keys }: { task_keys: string[] }) {
		return fetch.post<BatchTaskProgressResponse>(
			genRequestUrl("/api/v1/asr/tasks/progress/batch"),
			{ task_keys },
		)
	},
})
