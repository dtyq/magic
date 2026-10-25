import { assertProjectDeletionAllowed } from "@/services/recordSummary/projectDeletionRecordingGuard"
import { SuperMagicApi } from "@/apis"
import type { RecoverFinishRecordingTaskResponse } from "@/apis/modules/superMagic/recordSummary"
import type {
	AudioProjectListItem,
	AudioProjectSortBy,
	AudioProjectSortOrder,
	AudioRecordingSummaryFilter,
} from "@/types/audioProject"
import {
	applyClientSummaryFilter,
	buildAudioProjectsQueryParams,
	resolveRecordingDisplayName,
} from "@/pages/superMagic/pages/AudioRecordings/utils/audio-recordings-utils"
import { normalizeAudioProjectList } from "@/pages/superMagic/pages/AudioRecordings/utils/normalize-audio-project-item"
import { resolveAutoSummaryModelId } from "@/pages/superMagic/pages/AudioRecordings/utils/resolve-auto-summary-model-id"
import { resolveSummaryModelId } from "@/pages/superMagic/pages/AudioRecordings/utils/summary-action-utils"

const DEFAULT_AUDIO_SETTING_TOPIC_ID = "default_audio"
const BATCH_MOVE_PROJECTS_LIMIT = 20

export interface PagedAudioProjects {
	list: AudioProjectListItem[]
	page: number
	pageSize: number
	total: number
}

/** Filter and pagination inputs shared by list fetch and single-project lookup */
export interface QueryAudioProjectsOptions {
	page: number
	pageSize: number
	keyword: string
	summaryFilter: AudioRecordingSummaryFilter
	createdAtStart?: number
	createdAtEnd?: number
	sortBy: AudioProjectSortBy
	sortOrder: AudioProjectSortOrder
	projectIds?: string[]
	workspaceId?: string
}

/** Encapsulates audio recordings list API calls and DTO normalization */
export class AudioRecordingsService {
	/** Fetches one page, normalizes rows, and applies client-side summary tab filter */
	async queryProjects(options: QueryAudioProjectsOptions): Promise<PagedAudioProjects> {
		const response = await SuperMagicApi.queryAudioProjects(
			buildAudioProjectsQueryParams(options),
		)
		const list = applyClientSummaryFilter(
			normalizeAudioProjectList(response.list ?? []),
			options.summaryFilter,
		)

		return {
			list,
			page: options.page,
			pageSize: options.pageSize,
			total: response.total ?? 0,
		}
	}

	/** Persists a renamed audio project title */
	async renameProject(projectId: string, name: string): Promise<void> {
		await SuperMagicApi.editProject({
			id: projectId,
			project_name: name.trim(),
			project_description: "",
		})
	}

	/** Deletes multiple audio projects in one batch request */
	async batchDeleteProjects(projectIds: string[]): Promise<void> {
		assertProjectDeletionAllowed(projectIds)
		await SuperMagicApi.batchDeleteProjects({ project_ids: projectIds })
	}

	/** Moves audio projects in App-compatible chunks to avoid oversized batch requests */
	async batchMoveProjects(projectIds: string[], targetWorkspaceId: string): Promise<void> {
		for (let index = 0; index < projectIds.length; index += BATCH_MOVE_PROJECTS_LIMIT) {
			const batch = projectIds.slice(index, index + BATCH_MOVE_PROJECTS_LIMIT)
			if (batch.length === 0) continue
			await SuperMagicApi.batchMoveProjects({
				project_ids: batch,
				target_workspace_id: targetWorkspaceId,
			})
		}
	}

	/** Reads App-compatible recording settings so H5 manual summary honors the recording setting page */
	private async resolveRecordingSettingModelId(): Promise<string | undefined> {
		try {
			const setting = await SuperMagicApi.getSuperMagicTopicModel({
				topic_id: DEFAULT_AUDIO_SETTING_TOPIC_ID,
			})
			return setting.extra?.model?.model_id || setting.model?.model_id || undefined
		} catch {
			return undefined
		}
	}

	/** Resolves model_id from list item first, then default_audio settings, else auto model */
	async resolveModelIdForSubmit(itemModelId?: string): Promise<string | undefined> {
		if (itemModelId) return itemModelId

		const recordingSettingModelId = await this.resolveRecordingSettingModelId()
		if (recordingSettingModelId) return recordingSettingModelId

		const autoModelId = await resolveAutoSummaryModelId()
		return resolveSummaryModelId(undefined, autoModelId)
	}

	/** Triggers summarize API for imported vs recorded audio sources */
	async submitSummary(item: AudioProjectListItem, modelId: string): Promise<void> {
		const taskKey = item.task_key
		const topicId = item.topic_id
		if (!taskKey || !topicId) return

		if (item.audio_source === "imported") {
			await SuperMagicApi.getRecordingSummaryResult({
				task_key: taskKey,
				project_id: item.id,
				topic_id: topicId,
				model_id: modelId,
				file_id: item.audio_file_id,
			})
			return
		}

		await SuperMagicApi.summarizeRecordedTask({
			task_key: taskKey,
			topic_id: topicId,
			model_id: modelId,
		})
	}

	/** Triggers the backend re-summary API for an existing ASR task using the resolved model only. */
	async resubmitSummary(item: AudioProjectListItem, modelId: string): Promise<void> {
		if (!item.task_key) return

		await SuperMagicApi.resummarizeRecordedTask({
			task_key: item.task_key,
			model_id: modelId,
		})
	}

	/** Triggers the backend finish-recording recovery API for a merge_failed task.
	 *  No request body is sent; the backend recovers the task based on the task_key alone. */
	async retryMerge(item: AudioProjectListItem): Promise<RecoverFinishRecordingTaskResponse> {
		if (!item.task_key) {
			throw new Error("task_key is required for retry merge")
		}

		return SuperMagicApi.recoverFinishRecordingTask({ task_key: item.task_key })
	}

	/** Loads display title for detail header when navigation state omits projectName */
	async fetchProjectDisplayName(
		projectId: string,
		sortBy: AudioProjectSortBy,
		sortOrder: AudioProjectSortOrder,
	): Promise<string | null> {
		const data = await this.queryProjects({
			page: 1,
			pageSize: 1,
			keyword: "",
			summaryFilter: "all",
			sortBy,
			sortOrder,
			projectIds: [projectId],
		})

		const item = data.list[0]
		if (!item) return null

		const displayName = resolveRecordingDisplayName(item.project_name, item.created_at)
		return displayName || null
	}
}

export const audioRecordingsService = new AudioRecordingsService()
