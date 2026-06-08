import { makeAutoObservable, runInAction } from "mobx"
import type { RecordTaskProgress } from "@/apis/modules/superMagic/recordSummary"
import {
	audioRecordingsService,
	type PagedAudioProjects,
	type QueryAudioProjectsOptions,
} from "@/services/audioRecordings"
import type {
	AudioProjectListItem,
	AudioProjectSortBy,
	AudioProjectSortOrder,
	AudioRecordingSummaryFilter,
} from "@/types/audioProject"
import {
	appendUniqueById,
	beginPageRequest,
	isLatestPageRequest,
	resolveKeywordParam,
} from "@/pages/superMagic/utils/paged-list-store"
import { summaryProgressPoller } from "../services/summary-progress-poller"
import { resolveCardStatusFromListItem } from "../utils/normalize-audio-project-item"
import { canSubmitSummary, shouldPollSummaryProgress } from "../utils/summary-action-utils"

const DEFAULT_PAGE_SIZE = 20

export type SubmitSummaryResult =
	| { ok: true }
	| { ok: false; reason: "busy" | "missingParams" | "missingModel" | "api" }

/** MobX store for PC audio recordings list: filters, pagination, and fetch lifecycle */
export class AudioRecordingsStore {
	list: AudioProjectListItem[] = []
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	summaryFilter: AudioRecordingSummaryFilter = "all"
	createdAtStart?: number
	createdAtEnd?: number
	sortBy: AudioProjectSortBy = "created_at"
	sortOrder: AudioProjectSortOrder = "desc"
	loading = false
	loadingMore = false
	hasLoadedOnce = false
	private fetchRequestId = 0
	private lastPageLength = 0
	private total = 0
	submittingIds = new Set<string>()
	actionSubmittingIds = new Set<string>()
	private pollerRegistered = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/** Returns whether a given project is currently submitting a summary request */
	isSubmittingSummary(projectId: string) {
		return this.submittingIds.has(projectId)
	}

	/** Returns whether rename/delete is in flight for a given project */
	isSubmittingAction(projectId: string) {
		return this.actionSubmittingIds.has(projectId)
	}

	/**
	 * Whether the server may return another page.
	 * Uses server pagination (page × pageSize vs total), not client list.length,
	 * because normalize/tab filters can shrink visible rows without implying more pages.
	 */
	get hasMore() {
		if (this.total > 0) return this.page * this.pageSize < this.total
		return this.lastPageLength === this.pageSize
	}

	get isEmpty() {
		return !this.loading && this.list.length === 0
	}

	get showInitialSkeleton() {
		return this.loading && this.list.length === 0 && !this.hasLoadedOnce
	}

	reset() {
		this.list = []
		this.page = 1
		this.loading = false
		this.loadingMore = false
		this.hasLoadedOnce = false
		this.lastPageLength = 0
		this.total = 0
		this.submittingIds = new Set()
		this.actionSubmittingIds = new Set()
		summaryProgressPoller.dispose()
		this.pollerRegistered = false
	}

	/** Binds progress poller callbacks once per store lifetime */
	registerPollerCallbacks() {
		if (this.pollerRegistered) return
		this.pollerRegistered = true

		summaryProgressPoller.setCallbacks({
			onProgress: (task) => this.patchListItemFromProgress(task),
			onTaskDone: () => undefined,
			onTaskMissing: () => undefined,
		})
	}

	/** Unregisters poller when the list page unmounts */
	disposePoller() {
		summaryProgressPoller.dispose()
		this.pollerRegistered = false
	}

	setSummaryFilter(filter: AudioRecordingSummaryFilter) {
		this.summaryFilter = filter
	}

	setDateRange(start?: number, end?: number) {
		this.createdAtStart = start
		this.createdAtEnd = end
	}

	setSort(sortBy: AudioProjectSortBy, sortOrder: AudioProjectSortOrder) {
		this.sortBy = sortBy
		this.sortOrder = sortOrder
	}

	/** Builds query options from current filter state for service calls */
	private buildQueryOptions(page: number, keyword: string): QueryAudioProjectsOptions {
		return {
			page,
			pageSize: this.pageSize,
			keyword,
			summaryFilter: this.summaryFilter,
			createdAtStart: this.createdAtStart,
			createdAtEnd: this.createdAtEnd,
			sortBy: this.sortBy,
			sortOrder: this.sortOrder,
		}
	}

	/** Applies a fetched page to observable list state and registers in-progress poller tasks */
	private applyPageResult(
		page: number,
		keyword: string,
		data: PagedAudioProjects,
		append: boolean,
	) {
		runInAction(() => {
			this.list = append ? appendUniqueById(this.list, data.list) : data.list
			this.page = page
			this.keyword = keyword
			this.lastPageLength = data.list.length
			this.total = data.total
			this.registerInProgressTasksForPolling(data.list)
		})
	}

	async fetchList(options: { page?: number; keyword?: string } = {}) {
		const page = options.page ?? 1
		const keyword = resolveKeywordParam(options, this.keyword)
		const requestId = beginPageRequest({
			page,
			loading: this.loading,
			currentRequestId: this.fetchRequestId,
		})
		if (requestId == null) return

		this.fetchRequestId = requestId
		this.loading = true

		if (page === 1) {
			if (!this.hasLoadedOnce) this.list = []
			this.page = 1
			this.keyword = keyword
			this.loadingMore = false
		}

		try {
			const data = await audioRecordingsService.queryProjects(
				this.buildQueryOptions(page, keyword),
			)
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return

			this.applyPageResult(page, keyword, data, page !== 1)
			runInAction(() => {
				this.loading = false
				this.hasLoadedOnce = true
			})
		} catch {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loading = false
				this.hasLoadedOnce = true
				this.lastPageLength = 0
			})
		}
	}

	async loadMore() {
		if (this.loading || this.loadingMore || !this.hasMore) return

		this.loadingMore = true
		const nextPage = this.page + 1
		const requestId = this.fetchRequestId

		try {
			const data = await audioRecordingsService.queryProjects(
				this.buildQueryOptions(nextPage, this.keyword),
			)
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return

			this.applyPageResult(nextPage, this.keyword, data, true)
			runInAction(() => {
				this.loadingMore = false
			})
		} catch {
			if (!isLatestPageRequest({ requestId, currentRequestId: this.fetchRequestId })) return
			runInAction(() => {
				this.loadingMore = false
			})
		}
	}

	/** Registers summarizing tasks from a fetched page for background polling */
	private registerInProgressTasksForPolling(items: AudioProjectListItem[]) {
		for (const item of items) {
			if (!shouldPollSummaryProgress(item.current_phase, item.phase_status, item.task_key)) {
				continue
			}
			if (item.task_key) summaryProgressPoller.addTask(item.task_key)
		}
	}

	/** Merges a progress API result into the matching list item */
	patchListItemFromProgress(progress: RecordTaskProgress) {
		const projectId = progress.project_id
		if (!projectId) return

		const index = this.list.findIndex((item) => item.id === projectId)
		if (index < 0) return

		const current = this.list[index]
		const nextPhase = progress.current_phase ?? current.current_phase
		const nextStatus = progress.phase_status ?? current.phase_status
		const patched: AudioProjectListItem = {
			...current,
			current_phase: (nextPhase as AudioProjectListItem["current_phase"]) ?? null,
			phase_status: nextStatus ?? null,
			phase_percent: progress.phase_percent ?? current.phase_percent,
			project_status:
				nextStatus === "completed" && nextPhase === "summarizing"
					? "finished"
					: current.project_status,
			current_topic_status:
				nextStatus === "completed" && nextPhase === "summarizing"
					? "finished"
					: current.current_topic_status,
		}
		patched.card_status = resolveCardStatusFromListItem(patched)
		patched.is_summarized = patched.card_status === "summarized"

		runInAction(() => {
			this.list[index] = patched
		})
	}

	/** Triggers summary for a single list item and starts progress polling */
	async submitSummary(item: AudioProjectListItem): Promise<SubmitSummaryResult> {
		if (this.submittingIds.has(item.id)) return { ok: false, reason: "busy" }

		if (
			!canSubmitSummary({
				task_key: item.task_key,
				topic_id: item.topic_id,
				audio_file_id: item.audio_file_id,
				audio_source: item.audio_source,
			})
		) {
			return { ok: false, reason: "missingParams" }
		}

		const taskKey = item.task_key
		const topicId = item.topic_id
		if (!taskKey || !topicId) return { ok: false, reason: "missingParams" }

		const modelId = await audioRecordingsService.resolveModelIdForSubmit(item.model_id)
		if (!modelId) return { ok: false, reason: "missingModel" }

		runInAction(() => {
			this.submittingIds.add(item.id)
		})

		try {
			await audioRecordingsService.submitSummary(item, modelId)

			runInAction(() => {
				const index = this.list.findIndex((entry) => entry.id === item.id)
				if (index < 0) return

				const optimistic: AudioProjectListItem = {
					...this.list[index],
					current_phase: "summarizing",
					phase_status: "in_progress",
					card_status: "summarizing",
					is_summarized: false,
				}
				this.list[index] = optimistic
			})

			summaryProgressPoller.addTask(taskKey)
			return { ok: true }
		} catch {
			return { ok: false, reason: "api" }
		} finally {
			runInAction(() => {
				this.submittingIds.delete(item.id)
			})
		}
	}

	/** Renames an audio project and patches the local list on success */
	async renameProject(projectId: string, name: string): Promise<boolean> {
		const trimmed = name.trim()
		if (!trimmed || this.actionSubmittingIds.has(projectId)) return false

		runInAction(() => {
			this.actionSubmittingIds.add(projectId)
		})

		try {
			await audioRecordingsService.renameProject(projectId, trimmed)

			runInAction(() => {
				const index = this.list.findIndex((entry) => entry.id === projectId)
				if (index >= 0) {
					this.list[index] = { ...this.list[index], project_name: trimmed }
				}
			})
			return true
		} catch {
			return false
		} finally {
			runInAction(() => {
				this.actionSubmittingIds.delete(projectId)
			})
		}
	}

	/**
	 * Batch-deletes audio projects via super-agent batch-delete API.
	 * Local list is updated only after the API succeeds.
	 */
	async batchDeleteProjects(projectIds: string[]): Promise<boolean> {
		const uniqueIds = Array.from(new Set(projectIds.filter(Boolean)))
		if (uniqueIds.length === 0) return false

		const pendingIds = uniqueIds.filter((id) => !this.actionSubmittingIds.has(id))
		if (pendingIds.length === 0) return false

		runInAction(() => {
			pendingIds.forEach((id) => {
				this.actionSubmittingIds.add(id)
			})
		})

		try {
			await audioRecordingsService.batchDeleteProjects(pendingIds)

			runInAction(() => {
				const deletedIdSet = new Set(pendingIds)
				this.list = this.list.filter((entry) => !deletedIdSet.has(entry.id))
				if (this.total > 0) {
					this.total = Math.max(0, this.total - pendingIds.length)
				}
			})
			return true
		} catch {
			return false
		} finally {
			runInAction(() => {
				pendingIds.forEach((id) => {
					this.actionSubmittingIds.delete(id)
				})
			})
		}
	}

	/** Deletes a single audio project by delegating to batch-delete API */
	async deleteProject(projectId: string): Promise<boolean> {
		return this.batchDeleteProjects([projectId])
	}

	async fetchProjectName(projectId: string): Promise<string | null> {
		try {
			return await audioRecordingsService.fetchProjectDisplayName(
				projectId,
				this.sortBy,
				this.sortOrder,
			)
		} catch {
			return null
		}
	}
}
