import { CHARACTER_COUNT_LIMIT } from "@/components/business/RecordingSummary/const"
import type { HttpClient } from "@/apis/core/HttpClient"
import { genRequestUrl } from "@/utils/http"
import { UploadConfig as SDKUploadConfig } from "@dtyq/upload-sdk"

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
			upload_directory: string
			expires_in: number
			storage_type: "sandbox"
			workspace_directory_name: string
			user: {
				user_id: string
				organization_code: string
			}
			usage_note: string
			directories: {
				asr_hidden_dir: {
					directory_path: string
					directory_id: string
					hidden: boolean
					type: "asr_hidden_dir"
				}
				asr_display_dir: {
					directory_path: string
					directory_id: string
					hidden: boolean
					type: "asr_display_dir"
				}
			}
			preset_files: {
				note_file: {
					file_id: string
					file_name: string
					file_path: string
				}
				transcript_file: {
					file_id: string
					file_name: string
					file_path: string
				}
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
})
