import { ProjectDeletionBlockedByRecordingError } from "@/services/recordSummary/projectDeletionRecordingGuard"
import { makeAutoObservable, runInAction } from "mobx"
import type { RecordTaskProgress } from "@/apis/modules/superMagic/recordSummary"
import { ALL_RECORDING_GROUP_ID } from "@/services/audioRecordings/RecordingGroupsConstants"
import {
	audioRecordingsService,
	type PagedAudioProjects,
	type QueryAudioProjectsOptions,
} from "@/services/audioRecordings/AudioRecordingsService"
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
import { shouldPollSummaryProgress } from "../utils/summary-action-utils"
import {
	buildOptimisticRetryMergeProject,
	buildOptimisticSummarizingProject,
	deleteAudioRecordingProjects,
	renameAudioRecordingProject,
	resubmitAudioRecordingSummary,
	retryMergeAudioRecording,
	submitAudioRecordingSummary,
} from "../utils/audio-recording-actions"
import { resolveDatePresetRange } from "../utils/resolve-date-preset-range"
import type { AudioRecordingsFilterSessionSnapshot } from "../utils/audio-recordings-filter-session"

const DEFAULT_PAGE_SIZE = 20

export type SubmitSummaryResult =
	{ ok: true } | { ok: false; reason: "busy" | "missingParams" | "missingModel" | "api" }

export type RetryMergeResult =
	{ ok: true } | { ok: false; reason: "busy" | "missingParams" | "api" }

/** Uses progress duration only after backend reports a real value, preserving known local metadata */
function resolvePatchedDuration(progressDuration: number | undefined, currentDuration: number) {
	if (Number.isFinite(progressDuration) && progressDuration !== undefined && progressDuration > 0)
		return progressDuration
	return currentDuration
}

/** MobX store for PC audio recordings list: filters, pagination, and fetch lifecycle */
export class AudioRecordingsStore {
	list: AudioProjectListItem[] = []
	optimisticItems: AudioProjectListItem[] = []
	page = 1
	pageSize = DEFAULT_PAGE_SIZE
	keyword = ""
	summaryFilter: AudioRecordingSummaryFilter = "all"
	createdAtStart?: number
	createdAtEnd?: number
	workspaceId = ALL_RECORDING_GROUP_ID
	// Default to last-updated ordering so the desktop list matches the mobile recordings entry.
	sortBy: AudioProjectSortBy = "updated_at"
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

	/** Adds an optimistic item to keep track of local uploads/recording placeholders */
	addOptimisticItem(item: AudioProjectListItem) {
		this.optimisticItems = [item, ...this.optimisticItems.filter((x) => x.id !== item.id)]
	}

	/** Clears an optimistic item after it is replaced by an authoritative item */
	clearOptimisticItem(projectId: string) {
		this.optimisticItems = this.optimisticItems.filter((x) => x.id !== projectId)
	}

	/** Updates transfer status properties for an optimistic item during upload */
	updateOptimisticItemTransfer(
		projectId: string,
		status: AudioProjectListItem["transferStatus"],
		progress?: number,
	) {
		this.optimisticItems = this.optimisticItems.map((item) => {
			if (item.id !== projectId) return item
			const updatedItem = {
				...item,
				transferStatus: status,
				transferProgress: progress !== undefined ? progress : item.transferProgress,
			}
			updatedItem.card_status = resolveCardStatusFromListItem(updatedItem)
			return updatedItem
		})
	}

	/** Whether the server may return another page.
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
		// Keep optimisticItems across resets to preserve uploading items when switching pages
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

		// Trigger background polling for any already existing optimistic items
		this.registerInProgressTasksForPolling(this.optimisticItems)
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

	/** Restores persisted query filters in one pass before the first list request is built. */
	hydrateFiltersFromSession(snapshot: AudioRecordingsFilterSessionSnapshot) {
		const range = resolveDatePresetRange(snapshot.datePreset)
		this.summaryFilter = snapshot.summaryFilter
		this.createdAtStart = range.start
		this.createdAtEnd = range.end
		this.workspaceId = snapshot.groupId
		this.sortBy = snapshot.sortBy
		this.sortOrder = snapshot.sortOrder
	}

	/** Updates the workspace group used by subsequent list queries */
	setWorkspaceId(workspaceId: string) {
		this.workspaceId = workspaceId
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
			workspaceId: this.workspaceId,
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

	/**
	 * Patches both authoritative and optimistic caches before the backend responds, so
	 * PC/H5 list cards immediately switch to the summarizing state after a user action.
	 */
	private applyOptimisticSummarizingState(item: AudioProjectListItem) {
		const listIndex = this.list.findIndex((entry) => entry.id === item.id)
		const baseItem = listIndex >= 0 ? this.list[listIndex] : item
		const optimisticItem = buildOptimisticSummarizingProject(baseItem)

		if (listIndex >= 0) {
			this.list[listIndex] = optimisticItem
			return
		}
		this.optimisticItems = [
			optimisticItem,
			...this.optimisticItems.filter((entry) => entry.id !== item.id),
		]
	}

	/**
	 * Restores local caches when an optimistic summary submission fails before the
	 * backend accepts the task, preventing cards from staying in a false loading state.
	 */
	private rollbackOptimisticSummarizingState({
		itemId,
		previousListItem,
		previousOptimisticItem,
	}: {
		itemId: string
		previousListItem?: AudioProjectListItem
		previousOptimisticItem?: AudioProjectListItem
	}) {
		const listIndex = this.list.findIndex((entry) => entry.id === itemId)
		if (listIndex >= 0 && previousListItem) {
			this.list[listIndex] = previousListItem
		}

		if (previousOptimisticItem) {
			this.optimisticItems = [
				previousOptimisticItem,
				...this.optimisticItems.filter((entry) => entry.id !== itemId),
			]
			return
		}

		this.optimisticItems = this.optimisticItems.filter((entry) => entry.id !== itemId)
	}

	/**
	 * Patches both authoritative and optimistic caches to reflect an in-progress
	 * merge recovery, so PC/H5 list cards immediately switch to the "processing" state.
	 */
	private applyOptimisticProcessingState(item: AudioProjectListItem) {
		const listIndex = this.list.findIndex((entry) => entry.id === item.id)
		const baseItem = listIndex >= 0 ? this.list[listIndex] : item
		const optimisticItem = buildOptimisticRetryMergeProject(baseItem)

		if (listIndex >= 0) {
			this.list[listIndex] = optimisticItem
			return
		}
		this.optimisticItems = [
			optimisticItem,
			...this.optimisticItems.filter((entry) => entry.id !== item.id),
		]
	}

	/**
	 * Restores local caches when an optimistic merge recovery fails before the
	 * backend accepts the task, preventing cards from staying in a false "processing" state.
	 */
	private rollbackOptimisticProcessingState({
		itemId,
		previousListItem,
		previousOptimisticItem,
	}: {
		itemId: string
		previousListItem?: AudioProjectListItem
		previousOptimisticItem?: AudioProjectListItem
	}) {
		const listIndex = this.list.findIndex((entry) => entry.id === itemId)
		if (listIndex >= 0 && previousListItem) {
			this.list[listIndex] = previousListItem
		}

		if (previousOptimisticItem) {
			this.optimisticItems = [
				previousOptimisticItem,
				...this.optimisticItems.filter((entry) => entry.id !== itemId),
			]
			return
		}

		this.optimisticItems = this.optimisticItems.filter((entry) => entry.id !== itemId)
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

		// 1. Update matching authoritative item in store.list
		const index = this.list.findIndex((item) => item.id === projectId)
		if (index >= 0) {
			const current = this.list[index]
			const nextPhase = progress.current_phase ?? current.current_phase
			const nextStatus = progress.phase_status ?? current.phase_status
			const isFinished = nextStatus === "completed" && nextPhase === "summarizing"
			const patched: AudioProjectListItem = {
				...current,
				current_phase: (nextPhase as AudioProjectListItem["current_phase"]) ?? null,
				phase_status: nextStatus ?? null,
				phase_percent: progress.phase_percent ?? current.phase_percent,
				duration: resolvePatchedDuration(progress.duration_seconds, current.duration),
				project_status: isFinished ? "finished" : current.project_status,
				current_topic_status: isFinished ? "finished" : current.current_topic_status,
				is_summarized: isFinished ? true : current.is_summarized,
			}
			patched.card_status = resolveCardStatusFromListItem(patched)
			patched.is_summarized = patched.card_status === "summarized"

			runInAction(() => {
				this.list[index] = patched
			})
		}

		// 2. Update matching optimistic item in optimisticItems
		const optIndex = this.optimisticItems.findIndex((item) => item.id === projectId)
		if (optIndex >= 0) {
			const current = this.optimisticItems[optIndex]
			const nextPhase = progress.current_phase ?? current.current_phase
			const nextStatus = progress.phase_status ?? current.phase_status
			const isFinished = nextStatus === "completed" && nextPhase === "summarizing"
			const patched: AudioProjectListItem = {
				...current,
				current_phase: (nextPhase as AudioProjectListItem["current_phase"]) ?? null,
				phase_status: nextStatus ?? null,
				phase_percent: progress.phase_percent ?? current.phase_percent,
				duration: resolvePatchedDuration(progress.duration_seconds, current.duration),
				project_status: isFinished ? "finished" : current.project_status,
				current_topic_status: isFinished ? "finished" : current.current_topic_status,
				is_summarized: isFinished ? true : current.is_summarized,
			}
			patched.card_status = resolveCardStatusFromListItem(patched)
			patched.is_summarized = patched.card_status === "summarized"

			runInAction(() => {
				this.optimisticItems[optIndex] = patched
			})
		}
	}

	/** Triggers summary for a single list item and starts progress polling */
	async submitSummary(item: AudioProjectListItem): Promise<SubmitSummaryResult> {
		if (this.submittingIds.has(item.id)) return { ok: false, reason: "busy" }

		const taskKey = item.task_key
		if (!taskKey) return { ok: false, reason: "missingParams" }

		runInAction(() => {
			this.submittingIds.add(item.id)
		})

		try {
			const result = await submitAudioRecordingSummary(item)
			if (!result.ok) return result

			runInAction(() => {
				const index = this.list.findIndex((entry) => entry.id === item.id)
				if (index >= 0) {
					this.list[index] = buildOptimisticSummarizingProject(this.list[index])
				}

				const optimisticIndex = this.optimisticItems.findIndex(
					(entry) => entry.id === item.id,
				)
				if (optimisticIndex >= 0) {
					this.optimisticItems[optimisticIndex] = buildOptimisticSummarizingProject(
						this.optimisticItems[optimisticIndex],
					)
				}
			})

			summaryProgressPoller.addTask(taskKey)
			return { ok: true }
		} finally {
			runInAction(() => {
				this.submittingIds.delete(item.id)
			})
		}
	}

	/** Triggers re-summary for a single list item and starts progress polling */
	async resubmitSummary(item: AudioProjectListItem): Promise<SubmitSummaryResult> {
		if (this.submittingIds.has(item.id)) return { ok: false, reason: "busy" }

		const taskKey = item.task_key
		if (!taskKey) return { ok: false, reason: "missingParams" }
		const previousListItem = this.list.find((entry) => entry.id === item.id)
		const previousOptimisticItem = this.optimisticItems.find((entry) => entry.id === item.id)

		runInAction(() => {
			this.submittingIds.add(item.id)
			this.applyOptimisticSummarizingState(item)
		})

		try {
			const result = await resubmitAudioRecordingSummary(item)
			if (!result.ok) {
				runInAction(() => {
					this.rollbackOptimisticSummarizingState({
						itemId: item.id,
						previousListItem,
						previousOptimisticItem,
					})
				})
				return result
			}

			summaryProgressPoller.addTask(taskKey)
			return { ok: true }
		} finally {
			runInAction(() => {
				this.submittingIds.delete(item.id)
			})
		}
	}

	/** Triggers finish-recording recovery for a merge_failed item and starts progress polling */
	async retryMerge(item: AudioProjectListItem): Promise<RetryMergeResult> {
		if (this.submittingIds.has(item.id)) return { ok: false, reason: "busy" }

		const taskKey = item.task_key
		if (!taskKey) return { ok: false, reason: "missingParams" }
		const previousListItem = this.list.find((entry) => entry.id === item.id)
		const previousOptimisticItem = this.optimisticItems.find((entry) => entry.id === item.id)

		runInAction(() => {
			this.submittingIds.add(item.id)
			this.applyOptimisticProcessingState(item)
		})

		try {
			const result = await retryMergeAudioRecording(item)
			if (!result.ok) {
				runInAction(() => {
					this.rollbackOptimisticProcessingState({
						itemId: item.id,
						previousListItem,
						previousOptimisticItem,
					})
				})
				return result
			}

			// Add to poller for all cases; the poller patches the card to the correct terminal state.
			summaryProgressPoller.addTask(taskKey)
			return { ok: true }
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
			await renameAudioRecordingProject(projectId, trimmed)

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
			await deleteAudioRecordingProjects(pendingIds)

			runInAction(() => {
				const deletedIdSet = new Set(pendingIds)
				this.list = this.list.filter((entry) => !deletedIdSet.has(entry.id))
				if (this.total > 0) {
					this.total = Math.max(0, this.total - pendingIds.length)
				}
			})
			return true
		} catch (error) {
			if (error instanceof ProjectDeletionBlockedByRecordingError) throw error
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

export const audioRecordingsStore = new AudioRecordingsStore()
