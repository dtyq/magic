import { SuperMagicApi } from "@/apis"
import type { FileScope } from "@/apis/modules/fileScope"
import type { ProjectAttachmentsV2NextParentState } from "@/apis/modules/superMagic"
import type { FileAccessContext } from "../fileAccess/fileAccessContext"
import { resolveTemporaryTokenFromAccess } from "../fileAccess/fileAccessContext"
import type { AttachmentItem } from "../components/TopicFilesButton/hooks"
import { AttachmentDataProcessor } from "../utils/attachmentDataProcessor"
import { getProjectFileListScrollIdleDelayMs } from "../utils/fileListScrollActivity"
import {
	createProjectAttachmentsV2Builder,
	type ProjectAttachmentsV2Diagnostics,
	type ProjectAttachmentsV2Snapshot,
} from "../utils/projectAttachments/v2Adapter"
import {
	getProjectAttachmentsPerfNow,
	recordBatchSnapshotCommit,
	recordBatchSnapshotCommitDuration,
	recordBatchSnapshotCommitGap,
	recordBatchSnapshotIdleDeferred,
	recordBatchSnapshotLatestWins,
	recordBatchSnapshotScheduleWait,
	recordBatchSnapshotScrollDeferred,
	recordBatchSnapshotSkipped,
	recordProjectAttachmentsApiOverride,
	recordProjectAttachmentsBfsEmptyNextParentIds,
	recordProjectAttachmentsBfsRepeatedNextParentState,
	recordProjectAttachmentsCountRaw,
	recordProjectAttachmentsLoadTotal,
	recordProjectAttachmentsRequestAbort,
	recordProjectAttachmentsV2Diagnostics,
	recordProjectAttachmentsV2Fallback,
	recordProjectAttachmentsV2ForcedError,
	recordProjectAttachmentsV2LoadFailure,
	recordProjectAttachmentsV2PageFetch,
} from "./projectAttachmentsLoaderPerf"

export type ProjectAttachmentsSourceVersion = "v1" | "v2"
export type ProjectAttachmentsLoadStrategy =
	"force_v1" | "force_v2" | "count_v1" | "count_v2" | "fallback_v1"

export type ProjectAttachmentsFallbackReason =
	"count_failed" | "count_below_threshold" | "v2_fetch_failed" | "bfs_anomaly" | "forced_v1"

export interface ProjectAttachmentsDiagnostics extends Partial<ProjectAttachmentsV2Diagnostics> {
	fallback_reason?: ProjectAttachmentsFallbackReason
	adapter_warning_codes?: string[]
	bfs_warning_codes?: string[]
	bfs_page_count?: number
	next_parent_ids_count?: number
}

export interface ProjectAttachmentsLoadResult {
	tree: AttachmentItem[]
	list: AttachmentItem[]
	total: number
	sourceVersion: ProjectAttachmentsSourceVersion
	strategy: ProjectAttachmentsLoadStrategy
	rawTotal?: number
	rawRows?: number
	diagnostics: ProjectAttachmentsDiagnostics
	lastUpdatedAt?: string
}

export type ProjectAttachmentsBatchSnapshotPhase = "first" | "middle" | "final"

export type ProjectAttachmentsBatchSnapshotPayload = ProjectAttachmentsV2Snapshot & {
	level: number
	projectId: string
	phase: ProjectAttachmentsBatchSnapshotPhase
	isFinal: boolean
}

export interface ProjectAttachmentsLoaderOptions {
	projectId: string
	/** 特殊文件作用域；为空时保持原项目文件加载行为。 */
	scope?: FileScope
	/** Share access for published/share file trees. Omitted means session. */
	access?: FileAccessContext
	/** Explicit share token. Null/omit means session; never inherits window. */
	temporaryToken?: string | null
	threshold?: number
	pageSize?: number
	signal?: AbortSignal
	/** 仅调用方明确传入时覆盖全局请求错误提示策略。 */
	enableErrorMessagePrompt?: boolean
	onBatchSnapshot?: (payload: ProjectAttachmentsBatchSnapshotPayload) => void
	/**
	 * Keep is_hidden files in the processed tree/list for path lookup.
	 * Default false preserves the visible-only contract for file panels.
	 */
	includeHidden?: boolean
}

class ProjectAttachmentsBfsAnomalyError extends Error {
	constructor(readonly code: string) {
		super(code)
		this.name = "ProjectAttachmentsBfsAnomalyError"
	}
}

class ProjectAttachmentsAbortError extends Error {
	constructor() {
		super("Project attachments request aborted")
		this.name = "AbortError"
	}
}

const DEFAULT_THRESHOLD = 0
const DEFAULT_PAGE_SIZE = 1000
const MIDDLE_BATCH_SNAPSHOT_MIN_GAP_MS = 2500
const MIDDLE_BATCH_SNAPSHOT_IDLE_TIMEOUT_MS = 1200
const FILE_TYPES = ["user_upload", "user_create", "process", "system_auto_upload", "directory"]

type WindowWithIdleCallback = Window & {
	requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
	cancelIdleCallback?: (handle: number) => void
}

function resolveWindowSearchParams() {
	if (typeof window === "undefined") return new URLSearchParams()
	return new URLSearchParams(window.location.search)
}

function normalizeNextParentStates(
	nextParentIds: ProjectAttachmentsV2NextParentState[] | null | undefined,
) {
	// next_parent_ids is an opaque backend cursor; forward it as-is.
	if (!Array.isArray(nextParentIds)) return []
	return nextParentIds
}

function createNextParentStateKey(nextParentIds: ProjectAttachmentsV2NextParentState[]) {
	try {
		return JSON.stringify(nextParentIds)
	} catch (_error) {
		return nextParentIds
			.map((state, index) => `${index}:${String(state.parent_id || "")}`)
			.join("|")
	}
}

function createAbortError() {
	if (typeof DOMException !== "undefined") {
		return new DOMException("Project attachments request aborted", "AbortError")
	}
	return new ProjectAttachmentsAbortError()
}

function isProjectAttachmentsAbortError(error: unknown) {
	return (
		error instanceof ProjectAttachmentsAbortError ||
		(typeof DOMException !== "undefined" &&
			error instanceof DOMException &&
			error.name === "AbortError") ||
		(error as { name?: string } | null | undefined)?.name === "AbortError"
	)
}

function throwIfAborted(signal?: AbortSignal) {
	if (signal?.aborted) throw createAbortError()
}

export function createProjectAttachmentsBatchSnapshotScheduler(
	onBatchSnapshot: ProjectAttachmentsLoaderOptions["onBatchSnapshot"],
	options: { signal?: AbortSignal; middleMinGapMs?: number } = {},
) {
	let pendingPayload: ProjectAttachmentsBatchSnapshotPayload | null = null
	let pendingStartedAt = 0
	let pendingTimer: ReturnType<typeof setTimeout> | null = null
	let pendingFrame: number | null = null
	let pendingIdle: number | null = null
	let lastCommitAt: number | null = null
	const middleMinGapMs = options.middleMinGapMs ?? MIDDLE_BATCH_SNAPSHOT_MIN_GAP_MS
	const windowWithIdleCallback = () =>
		typeof window !== "undefined" ? (window as WindowWithIdleCallback) : undefined

	const cancelFrame = () => {
		if (pendingFrame === null) return
		if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
			window.cancelAnimationFrame(pendingFrame)
		}
		pendingFrame = null
	}

	const cancelIdle = () => {
		if (pendingIdle === null) return
		const idleWindow = windowWithIdleCallback()
		if (typeof idleWindow?.cancelIdleCallback === "function") {
			idleWindow.cancelIdleCallback(pendingIdle)
		}
		pendingIdle = null
	}

	const clearPending = (reason: string) => {
		if (pendingTimer) {
			clearTimeout(pendingTimer)
			pendingTimer = null
		}
		cancelFrame()
		cancelIdle()
		if (pendingPayload) {
			recordBatchSnapshotSkipped(reason, pendingPayload)
		}
		pendingPayload = null
		pendingStartedAt = 0
	}

	const commitPayload = (
		payload: ProjectAttachmentsBatchSnapshotPayload,
		scheduledAt: number,
	) => {
		if (!onBatchSnapshot) return
		// Fast project/topic switches can stale page results; check abort before commit.
		if (options.signal?.aborted) {
			recordBatchSnapshotSkipped("aborted", payload)
			return
		}

		const commitStartedAt = getProjectAttachmentsPerfNow()
		recordBatchSnapshotScheduleWait(payload, Math.max(0, commitStartedAt - scheduledAt))

		onBatchSnapshot(payload)
		recordBatchSnapshotCommit(payload)

		const committedAt = getProjectAttachmentsPerfNow()
		if (lastCommitAt !== null) {
			recordBatchSnapshotCommitGap(payload, committedAt - lastCommitAt)
		}
		lastCommitAt = committedAt

		recordBatchSnapshotCommitDuration(payload, commitStartedAt)
	}

	const commitNow = (payload: ProjectAttachmentsBatchSnapshotPayload) => {
		commitPayload(payload, getProjectAttachmentsPerfNow())
	}

	const commitPendingWhenIdle = () => {
		const commit = () => {
			pendingIdle = null
			const payload = pendingPayload
			const startedAt = pendingStartedAt
			if (!payload) return

			const scrollIdleDelayMs = getProjectFileListScrollIdleDelayMs()
			if (scrollIdleDelayMs > 0) {
				recordBatchSnapshotScrollDeferred(payload)
				pendingTimer = setTimeout(() => {
					pendingTimer = null
					commitPendingInFrame()
				}, scrollIdleDelayMs)
				return
			}

			pendingPayload = null
			pendingStartedAt = 0
			commitPayload(payload, startedAt)
		}

		const idleWindow = windowWithIdleCallback()
		if (typeof idleWindow?.requestIdleCallback === "function") {
			recordBatchSnapshotIdleDeferred(pendingPayload)
			pendingIdle = idleWindow.requestIdleCallback(commit, {
				timeout: MIDDLE_BATCH_SNAPSHOT_IDLE_TIMEOUT_MS,
			})
			return
		}

		commit()
	}

	const commitPendingInFrame = () => {
		const commit = () => {
			pendingFrame = null
			const payload = pendingPayload
			if (!payload) return

			const scrollIdleDelayMs = getProjectFileListScrollIdleDelayMs()
			if (scrollIdleDelayMs > 0) {
				recordBatchSnapshotScrollDeferred(payload)
				pendingTimer = setTimeout(() => {
					pendingTimer = null
					commitPendingInFrame()
				}, scrollIdleDelayMs)
				return
			}

			commitPendingWhenIdle()
		}

		if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
			pendingFrame = window.requestAnimationFrame(commit)
			return
		}
		commit()
	}

	const getMiddleCommitDelayMs = () => {
		const now = getProjectAttachmentsPerfNow()
		if (lastCommitAt === null) return 0
		return Math.max(0, lastCommitAt + middleMinGapMs - now)
	}

	return {
		commitFirst(payload: ProjectAttachmentsV2Snapshot & { level: number; projectId: string }) {
			clearPending("first_snapshot")
			commitNow({
				...payload,
				phase: "first",
				isFinal: false,
			})
		},
		scheduleMiddle(
			payload: ProjectAttachmentsV2Snapshot & { level: number; projectId: string },
		) {
			if (!onBatchSnapshot || options.signal?.aborted) return

			if (pendingPayload) {
				recordBatchSnapshotLatestWins(pendingPayload, payload)
			}

			pendingPayload = {
				...payload,
				phase: "middle",
				isFinal: false,
			}
			pendingStartedAt = getProjectAttachmentsPerfNow()

			if (pendingTimer || pendingFrame !== null || pendingIdle !== null) return
			pendingTimer = setTimeout(() => {
				pendingTimer = null
				commitPendingInFrame()
			}, getMiddleCommitDelayMs())
		},
		commitFinal(payload: ProjectAttachmentsV2Snapshot & { level: number; projectId: string }) {
			clearPending("final_snapshot")
			commitNow({
				...payload,
				phase: "final",
				isFinal: true,
			})
		},
		cancelPending(reason = "cancel") {
			clearPending(reason)
		},
	}
}

function toProcessedResult(
	data: { tree: AttachmentItem[]; list: AttachmentItem[]; total?: number },
	options?: { preserveList?: boolean },
) {
	const processedData = AttachmentDataProcessor.processAttachmentData(
		{ tree: data.tree || [], list: data.list || [] },
		options,
	)
	return {
		tree: processedData.tree,
		list: processedData.list,
		total: data.total ?? processedData.list.length,
	}
}

async function loadAttachmentsViaV1(params: {
	projectId: string
	scope?: FileScope
	temporaryToken?: string
	strategy: ProjectAttachmentsLoadStrategy
	rawTotal?: number
	fallbackReason?: ProjectAttachmentsFallbackReason
	signal?: AbortSignal
	enableErrorMessagePrompt?: boolean
}): Promise<ProjectAttachmentsLoadResult> {
	try {
		throwIfAborted(params.signal)
		const response = await SuperMagicApi.getAttachmentsByProjectId(
			{
				projectId: params.projectId,
				scope: params.scope,
				temporaryToken: params.temporaryToken,
			},
			{
				signal: params.signal,
				...(params.enableErrorMessagePrompt !== undefined
					? { enableErrorMessagePrompt: params.enableErrorMessagePrompt }
					: {}),
			},
		)
		throwIfAborted(params.signal)
		const processed = toProcessedResult(response)
		return {
			...processed,
			sourceVersion: "v1",
			strategy: params.strategy,
			rawTotal: params.rawTotal,
			rawRows: Array.isArray(response?.list) ? response.list.length : undefined,
			diagnostics: {
				fallback_reason: params.fallbackReason,
			},
		}
	} catch (error) {
		if (isProjectAttachmentsAbortError(error)) {
			recordProjectAttachmentsRequestAbort("v1")
		}
		throw error
	}
}

async function loadAttachmentsViaV2(params: {
	projectId: string
	scope?: FileScope
	temporaryToken?: string
	pageSize: number
	strategy: ProjectAttachmentsLoadStrategy
	rawTotal?: number
	onBatchSnapshot?: ProjectAttachmentsLoaderOptions["onBatchSnapshot"]
	signal?: AbortSignal
	includeHidden?: boolean
	enableErrorMessagePrompt?: boolean
}): Promise<ProjectAttachmentsLoadResult> {
	// V2 uses backend cursors for BFS paging; builder emits optional page snapshots.
	const builder = createProjectAttachmentsV2Builder({
		includeHidden: params.includeHidden,
	})
	const batchSnapshotScheduler = createProjectAttachmentsBatchSnapshotScheduler(
		params.onBatchSnapshot,
		{ signal: params.signal },
	)
	const seenNextParentStateKeys = new Set<string>()
	let requestNextParentIds: ProjectAttachmentsV2NextParentState[] | undefined
	let pageIndex = 0
	let pageCount = 0
	let nextParentIdsCount = 0
	let bfsWarningCode: string | undefined
	let hasNextPage = true
	let isFirstSnapshot = true

	try {
		while (hasNextPage) {
			throwIfAborted(params.signal)
			const pageFetchStartedAt = getProjectAttachmentsPerfNow()
			const response = await SuperMagicApi.getProjectAttachmentsV2Page(
				{
					projectId: params.projectId,
					scope: params.scope,
					nextParentIds: requestNextParentIds,
					pageSize: params.pageSize,
					fileType: FILE_TYPES,
					temporaryToken: params.temporaryToken,
				},
				{
					signal: params.signal,
					...(params.enableErrorMessagePrompt !== undefined
						? { enableErrorMessagePrompt: params.enableErrorMessagePrompt }
						: {}),
				},
			)
			recordProjectAttachmentsV2PageFetch(pageFetchStartedAt, {
				pageIndex,
				pageSize: params.pageSize,
			})
			throwIfAborted(params.signal)

			const nextParentIds = normalizeNextParentStates(response.next_parent_ids)
			builder.mergeBatch(response.list || [])
			pageCount += 1
			nextParentIdsCount += nextParentIds.length

			if (response.has_more && nextParentIds.length === 0) {
				// has_more=true without the next cursor would loop, so fallback.
				bfsWarningCode = "empty_next_parent_ids_with_has_more"
				recordProjectAttachmentsBfsEmptyNextParentIds()
				throw new ProjectAttachmentsBfsAnomalyError(bfsWarningCode)
			}

			const hasMoreAfterPage = Boolean(response.has_more && nextParentIds.length > 0)
			if (params.onBatchSnapshot && hasMoreAfterPage) {
				const snapshot = builder.snapshot()
				const payload = {
					...snapshot,
					level: pageIndex,
					projectId: params.projectId,
				}
				if (isFirstSnapshot) {
					batchSnapshotScheduler.commitFirst(payload)
					isFirstSnapshot = false
				} else {
					batchSnapshotScheduler.scheduleMiddle(payload)
				}
			}

			if (!hasMoreAfterPage) {
				hasNextPage = false
				break
			}

			const nextParentStateKey = createNextParentStateKey(nextParentIds)
			if (seenNextParentStateKeys.has(nextParentStateKey)) {
				// A repeated cursor state means a backend cycle would repeat the same page.
				bfsWarningCode = "repeated_next_parent_state"
				recordProjectAttachmentsBfsRepeatedNextParentState()
				throw new ProjectAttachmentsBfsAnomalyError(bfsWarningCode)
			}

			seenNextParentStateKeys.add(nextParentStateKey)
			requestNextParentIds = nextParentIds
			pageIndex += 1
		}

		throwIfAborted(params.signal)
		const snapshot = builder.finalize()
		batchSnapshotScheduler.commitFinal({
			...snapshot,
			level: pageIndex,
			projectId: params.projectId,
		})
		const processed = toProcessedResult(snapshot, { preserveList: true })

		recordProjectAttachmentsV2Diagnostics({
			pageCount,
			nextParentIdsCount,
			strategy: params.strategy,
			diagnostics: snapshot.diagnostics,
		})

		return {
			...processed,
			sourceVersion: "v2",
			strategy: params.strategy,
			rawTotal: params.rawTotal,
			rawRows: snapshot.diagnostics.rawRows,
			diagnostics: {
				...snapshot.diagnostics,
				adapter_warning_codes: snapshot.diagnostics.adapterWarningCodes,
				bfs_warning_codes: bfsWarningCode ? [bfsWarningCode] : [],
				bfs_page_count: pageCount,
				next_parent_ids_count: nextParentIdsCount,
			},
		}
	} catch (error) {
		batchSnapshotScheduler.cancelPending("load_error")
		throw error
	}
}

export async function loadProjectAttachments(
	options: ProjectAttachmentsLoaderOptions,
): Promise<ProjectAttachmentsLoadResult> {
	throwIfAborted(options.signal)
	const loadStartedAt = getProjectAttachmentsPerfNow()
	const searchParams = resolveWindowSearchParams()
	const versionOverride = searchParams.get("attachments_version")
	const allowFallback = searchParams.get("attachments_fallback") === "v1"
	const temporaryToken = resolveTemporaryTokenFromAccess(options.access, options.temporaryToken)
	const threshold = options.threshold ?? DEFAULT_THRESHOLD
	const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
	const finalizeLoadResult = (result: ProjectAttachmentsLoadResult) => {
		recordProjectAttachmentsLoadTotal(loadStartedAt, result)
		return result
	}

	if (versionOverride === "v1") {
		recordProjectAttachmentsApiOverride("force_v1")
		return finalizeLoadResult(
			await loadAttachmentsViaV1({
				projectId: options.projectId,
				scope: options.scope,
				temporaryToken,
				strategy: "force_v1",
				fallbackReason: "forced_v1",
				signal: options.signal,
				enableErrorMessagePrompt: options.enableErrorMessagePrompt,
			}),
		)
	}

	const loadV2WithFallback = async (
		strategy: ProjectAttachmentsLoadStrategy,
		rawTotal?: number,
	) => {
		try {
			return await loadAttachmentsViaV2({
				projectId: options.projectId,
				scope: options.scope,
				temporaryToken,
				pageSize,
				strategy,
				rawTotal,
				onBatchSnapshot: options.onBatchSnapshot,
				signal: options.signal,
				includeHidden: options.includeHidden,
				enableErrorMessagePrompt: options.enableErrorMessagePrompt,
			})
		} catch (error) {
			// Abort is normal on user switches; do not swallow it and fallback to V1.
			if (isProjectAttachmentsAbortError(error)) {
				recordProjectAttachmentsRequestAbort("v2")
				throw error
			}
			const isBfsAnomaly = error instanceof ProjectAttachmentsBfsAnomalyError
			recordProjectAttachmentsV2LoadFailure(isBfsAnomaly)
			if (strategy === "force_v2" && !allowFallback) {
				recordProjectAttachmentsV2ForcedError()
				throw error
			}
			const fallbackReason = isBfsAnomaly ? "bfs_anomaly" : "v2_fetch_failed"
			recordProjectAttachmentsV2Fallback(fallbackReason)
			return loadAttachmentsViaV1({
				projectId: options.projectId,
				scope: options.scope,
				temporaryToken,
				strategy: "fallback_v1",
				rawTotal,
				fallbackReason,
				signal: options.signal,
				enableErrorMessagePrompt: options.enableErrorMessagePrompt,
			})
		}
	}

	if (versionOverride === "v2") {
		recordProjectAttachmentsApiOverride("force_v2")
		return finalizeLoadResult(await loadV2WithFallback("force_v2"))
	}

	let rawTotal = 0
	try {
		throwIfAborted(options.signal)
		const countResponse = await SuperMagicApi.getProjectAttachmentsCount(
			{
				projectId: options.projectId,
				scope: options.scope,
				temporaryToken,
			},
			{
				signal: options.signal,
				...(options.enableErrorMessagePrompt !== undefined
					? { enableErrorMessagePrompt: options.enableErrorMessagePrompt }
					: {}),
			},
		)
		throwIfAborted(options.signal)
		rawTotal = Number(countResponse?.total || 0)
		recordProjectAttachmentsCountRaw(rawTotal)
	} catch (error) {
		if (isProjectAttachmentsAbortError(error)) {
			recordProjectAttachmentsRequestAbort("count")
			throw error
		}
		recordProjectAttachmentsV2Fallback("count_failed")
		return finalizeLoadResult(
			await loadAttachmentsViaV1({
				projectId: options.projectId,
				scope: options.scope,
				temporaryToken,
				strategy: "fallback_v1",
				fallbackReason: "count_failed",
				signal: options.signal,
				enableErrorMessagePrompt: options.enableErrorMessagePrompt,
			}),
		)
	}

	if (rawTotal >= threshold) {
		// Large projects use V2 paging to avoid loading every file at once.
		return finalizeLoadResult(await loadV2WithFallback("count_v2", rawTotal))
	}

	// Small projects keep V1 to reduce requests; the result shape stays unified.
	return finalizeLoadResult(
		await loadAttachmentsViaV1({
			projectId: options.projectId,
			scope: options.scope,
			temporaryToken,
			strategy: "count_v1",
			rawTotal,
			fallbackReason: "count_below_threshold",
			signal: options.signal,
			enableErrorMessagePrompt: options.enableErrorMessagePrompt,
		}),
	)
}
