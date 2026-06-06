import { SuperMagicApi } from "@/apis"
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
		await SuperMagicApi.batchDeleteProjects({ project_ids: projectIds })
	}

	/** Resolves model_id from list item extra first, else auto model from summary mode API */
	async resolveModelIdForSubmit(itemModelId?: string): Promise<string | undefined> {
		if (itemModelId) return itemModelId

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
