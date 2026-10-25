import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import type { SeqResponse } from "@/types/request"
import type {
	SuperMagicFileChangeItem,
	SuperMagicFileChangeMessage,
} from "@/types/chat/intermediate_message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import projectFilesStoreDefault, { ProjectFilesStore } from "@/stores/projectFiles"
import { useFileAccess } from "../fileAccess/FileAccessProvider"
import { isSharePageLocation } from "../fileAccess/fileAccessContext"
import {
	getSharedMediaResourceScope,
	useSharedMediaResourceScope,
} from "../services/sharedMediaResourceScope"
import { resolveAttachmentsRefreshWaitersForProject } from "../services/attachmentsTopicSync"
import { projectAttachmentsChangeLog } from "../utils/projectAttachments/changeLogReporter"
import { markProjectAttachmentsLastUpdated } from "../utils/projectAttachments/lastUpdatedCache"
import {
	DEFAULT_PROJECT_ATTACHMENTS_CHANGE_DEBOUNCE_MS,
	DEFAULT_PROJECT_ATTACHMENTS_PARENT_REFRESH_WINDOW_MS,
	collectFileChangeParentRefreshIds,
	loadProjectAttachmentsSingleflight,
	normalizeRefreshParentIds,
	resolveProjectAttachmentsChangeEvent,
	shouldSkipParentChildrenReconcileAfterWsApply,
} from "../utils/projectAttachments/changeRealtimeUtils"
import { resolveProjectAttachmentMutationWaiters } from "../utils/projectAttachments/attachmentMutationWaiter"
import {
	useProjectAttachmentsRefreshParentWindow,
	type ProjectAttachmentsChangeRealtimeData,
} from "./useProjectAttachmentsRefreshParentWindow"

interface UseProjectAttachmentsChangeRealtimeOptions {
	projectId?: string
	enabled?: boolean
	store?: ProjectFilesStore
	debounceMs?: number
	parentRefreshWindowMs?: number
	onAttachmentsChange?: (data: ProjectAttachmentsChangeRealtimeData) => void
	onFallbackError?: (error: unknown, projectId: string) => void
}

export function useProjectAttachmentsChangeRealtime({
	projectId,
	enabled = true,
	store = projectFilesStoreDefault,
	debounceMs = DEFAULT_PROJECT_ATTACHMENTS_CHANGE_DEBOUNCE_MS,
	parentRefreshWindowMs = DEFAULT_PROJECT_ATTACHMENTS_PARENT_REFRESH_WINDOW_MS,
	onAttachmentsChange,
	onFallbackError,
}: UseProjectAttachmentsChangeRealtimeOptions) {
	const fileAccess = useFileAccess()
	const accessScope = useSharedMediaResourceScope()
	// 分享预览不能借恢复入口改成宿主的全项目读取；显式 session 的运行态仍沿用原权限。
	const canRecover =
		fileAccess?.kind !== "share" && (!isSharePageLocation() || fileAccess?.kind === "session")
	// Merge seqs within the debounce window, then apply once to reduce MobX commits.
	const pendingChangesRef = useRef<SuperMagicFileChangeItem[]>([])
	const pendingSeqKeysRef = useRef<string[]>([])
	const pendingRefreshParentIdsRef = useRef<string[]>([])
	const pendingTraceIdRef = useRef<string>("")
	const pendingLastUpdatedAtRef = useRef<string>("")
	const parentMissingRetryCountRef = useRef(0)
	const currentProjectIdRef = useRef(projectId)
	const subscriptionVersionRef = useRef(0)
	const pendingResumeRef = useRef(false)
	// Pause WS incremental apply while parent_missing waits for a full-refresh fallback.
	const fallbackRefreshInFlightRef = useRef(false)
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const onAttachmentsChangeRef = useRef(onAttachmentsChange)
	const onFallbackErrorRef = useRef(onFallbackError)

	currentProjectIdRef.current = projectId

	useEffect(() => {
		onAttachmentsChangeRef.current = onAttachmentsChange
	}, [onAttachmentsChange])

	useEffect(() => {
		onFallbackErrorRef.current = onFallbackError
	}, [onFallbackError])

	const {
		scheduleParentRefresh,
		clearRefreshParentWindow,
		clearRefreshParentChildrenWindow,
		abortRefreshParentRequests,
	} = useProjectAttachmentsRefreshParentWindow({
		projectId,
		store,
		parentRefreshWindowMs,
		onAttachmentsChange,
	})

	const runFallbackRefresh = useMemoizedFn(
		async (context: {
			reason?: string
			traceId: string
			seqKeys: string[]
			lastUpdatedAt: string
			changes: SuperMagicFileChangeItem[]
			isResume?: boolean
		}) => {
			const fallbackProjectId = projectId
			if (!fallbackProjectId) {
				fallbackRefreshInFlightRef.current = false
				return
			}
			const { reason, traceId, lastUpdatedAt } = context
			const subscriptionVersion = subscriptionVersionRef.current
			const refreshScope = accessScope
			const isCurrentRefresh = () =>
				currentProjectIdRef.current === fallbackProjectId &&
				subscriptionVersionRef.current === subscriptionVersion &&
				getSharedMediaResourceScope() === refreshScope
			fallbackRefreshInFlightRef.current = true
			projectAttachmentsChangeLog.fallbackStart(fallbackProjectId, context)

			try {
				// Fallback realigns the frontend tree with a full attachment load.
				const res = await loadProjectAttachmentsSingleflight(fallbackProjectId)
				if (!isCurrentRefresh()) {
					projectAttachmentsChangeLog.fallbackSkippedStaleProject(
						fallbackProjectId,
						currentProjectIdRef.current,
						context,
					)
					return
				}

				store.setWorkspaceFileTree(res.tree)
				markProjectAttachmentsLastUpdated(fallbackProjectId, lastUpdatedAt)
				projectAttachmentsChangeLog.fallbackSuccess(fallbackProjectId, context, {
					treeCount: res.tree.length,
					listCount: res.list.length,
				})
				resolveProjectAttachmentMutationWaiters({
					projectId: fallbackProjectId,
					store,
					changes: context.changes,
					source: "fallback",
				})
				onAttachmentsChangeRef.current?.({
					tree: res.tree,
					list: res.list,
					projectId: fallbackProjectId,
					source: "fallback",
					fallbackReason: reason,
				})
				if (context.isResume && isCurrentRefresh()) {
					// 请求 settled 不等于成功提交；只在 store 和页面回调完成后通知画布。
					pubsub.publish(PubSubEvents.Super_Magic_Project_Attachments_Reconciled, {
						projectId: fallbackProjectId,
						accessScope: refreshScope,
						store,
						snapshot: res,
					})
				}
			} catch (error) {
				if (!isCurrentRefresh()) return
				projectAttachmentsChangeLog.fallbackError(fallbackProjectId, context, error)
				onFallbackErrorRef.current?.(error, fallbackProjectId)
			} finally {
				// 旧项目／旧身份的 finally 不能清除新一轮的请求和事件状态。
				if (isCurrentRefresh()) {
					fallbackRefreshInFlightRef.current = false
					if (pendingTraceIdRef.current === traceId) {
						pendingTraceIdRef.current = ""
					}
					if (pendingLastUpdatedAtRef.current === lastUpdatedAt) {
						pendingLastUpdatedAtRef.current = ""
					}
					if (
						pendingChangesRef.current.length ||
						pendingRefreshParentIdsRef.current.length ||
						pendingResumeRef.current
					) {
						scheduleFlush()
					}
				}
			}
		},
	)

	const flushPendingChanges = useMemoizedFn(() => {
		if (!projectId) return
		if (fallbackRefreshInFlightRef.current) {
			projectAttachmentsChangeLog.applyDeferredDuringFallback({
				projectId,
				traceId: pendingTraceIdRef.current,
				pendingChangeCount: pendingChangesRef.current.length,
				pendingSeqKeys: pendingSeqKeysRef.current,
			})
			return
		}
		const changes = pendingChangesRef.current
		const seqKeys = pendingSeqKeysRef.current
		const refreshParentIds = pendingRefreshParentIdsRef.current
		const traceId = pendingTraceIdRef.current
		const lastUpdatedAt = pendingLastUpdatedAtRef.current
		const isResume =
			pendingResumeRef.current && canRecover && !document.hidden && navigator.onLine
		pendingChangesRef.current = []
		pendingSeqKeysRef.current = []
		pendingRefreshParentIdsRef.current = []
		// Clear pending before apply/fallback; events during apply enter the next trace.
		pendingTraceIdRef.current = ""
		pendingLastUpdatedAtRef.current = ""
		if (isResume) {
			pendingResumeRef.current = false
			// 复用原回退队列：休眠期间可能漏通知，不能凭数量／更新时间相同跳过快照。
			clearRefreshParentWindow()
			clearRefreshParentChildrenWindow()
			abortRefreshParentRequests()
			void runFallbackRefresh({
				reason: "page_resume",
				traceId,
				seqKeys,
				lastUpdatedAt,
				changes,
				isResume: true,
			})
			return
		}
		if (changes.length === 0 && refreshParentIds.length === 0) {
			projectAttachmentsChangeLog.flushSkippedEmptyBatch(projectId, traceId)
			return
		}

		const batchLogContext = { projectId, traceId, seqKeys, lastUpdatedAt, changes }
		projectAttachmentsChangeLog.flushStart(batchLogContext)

		if (changes.length === 0) {
			scheduleParentRefresh({
				parentItemIds: refreshParentIds,
				childrenParentIds: [],
				traceId,
				seqKeys,
				lastUpdatedAt,
			})
			return
		}

		const workspaceFilesListBeforeApply = store.workspaceFilesList
		let result: ReturnType<typeof store.applyFileChanges>
		try {
			result = store.applyFileChanges(changes, {
				applySource: "ws_realtime",
				trace: {
					traceId,
					projectId,
					seqKeys,
					batchSize: changes.length,
				},
			})
		} catch (error) {
			projectAttachmentsChangeLog.applyError(batchLogContext, error)
			throw error
		}
		if (result.fallbackRequired) {
			// Parent/child events may arrive close together; retry once before full refresh.
			if (
				result.fallbackReason === "parent_missing" &&
				parentMissingRetryCountRef.current < 2
			) {
				parentMissingRetryCountRef.current += 1
				pendingChangesRef.current = [...changes, ...pendingChangesRef.current]
				pendingSeqKeysRef.current = [...seqKeys, ...pendingSeqKeysRef.current]
				pendingRefreshParentIdsRef.current = normalizeRefreshParentIds([
					...refreshParentIds,
					...pendingRefreshParentIdsRef.current,
				])
				pendingTraceIdRef.current = traceId
				pendingLastUpdatedAtRef.current = lastUpdatedAt
				scheduleFlush()
				return
			}

			parentMissingRetryCountRef.current = 0
			projectAttachmentsChangeLog.applyRequestedFallback(batchLogContext, result)
			fallbackRefreshInFlightRef.current = true
			clearRefreshParentWindow()
			clearRefreshParentChildrenWindow()
			// Fallback is async but uses this batch's fixed trace/seq/lastUpdated.
			void runFallbackRefresh({
				reason: result.fallbackReason,
				traceId,
				seqKeys,
				lastUpdatedAt,
				changes,
			})
			return
		}

		parentMissingRetryCountRef.current = 0
		markProjectAttachmentsLastUpdated(projectId, lastUpdatedAt)
		// Treat WS apply as refresh completion for legacy waiters.
		resolveAttachmentsRefreshWaitersForProject(projectId)
		resolveProjectAttachmentMutationWaiters({
			projectId,
			store,
			changes,
			source: "ws",
		})
		projectAttachmentsChangeLog.applySuccess(batchLogContext, result)
		onAttachmentsChangeRef.current?.({
			tree: result.tree,
			list: result.list,
			projectId,
			source: "ws",
		})
		// File changes reconcile the parent subtree; refresh_parent_ids only updates parent items.
		const skipParentRefreshAfterWsApply = shouldSkipParentChildrenReconcileAfterWsApply(changes)
		const childrenRefreshParentIds = skipParentRefreshAfterWsApply
			? []
			: collectFileChangeParentRefreshIds(changes, workspaceFilesListBeforeApply)
		const itemOnlyRefreshParentIds = normalizeRefreshParentIds(refreshParentIds).filter(
			(parentId: string) => !childrenRefreshParentIds.includes(parentId),
		)
		// Move/update payloads already applied; defer folder updated_at-only refresh to avoid a second render spike.
		if (skipParentRefreshAfterWsApply && childrenRefreshParentIds.length === 0) {
			if (itemOnlyRefreshParentIds.length > 0) {
				projectAttachmentsChangeLog.refreshParentIdsSkipped({
					projectId,
					parentIds: itemOnlyRefreshParentIds,
					reason: "deferred_after_ws_file_apply",
					traceId,
				})
			}
			return
		}
		scheduleParentRefresh({
			parentItemIds: itemOnlyRefreshParentIds,
			childrenParentIds: childrenRefreshParentIds,
			traceId,
			seqKeys,
			lastUpdatedAt,
		})
	})

	const scheduleFlush = useMemoizedFn(() => {
		if (timerRef.current) clearTimeout(timerRef.current)
		projectAttachmentsChangeLog.flushScheduled({
			projectId,
			debounceMs,
			pendingChangeCount: pendingChangesRef.current.length,
			pendingSeqKeys: pendingSeqKeysRef.current,
			traceId: pendingTraceIdRef.current,
		})
		// A short debounce balances realtime updates with render/sort cost.
		timerRef.current = setTimeout(() => {
			timerRef.current = null
			flushPendingChanges()
		}, debounceMs)
	})

	const handleFileChangeIntermediate = useMemoizedFn(
		(seq: SeqResponse<SuperMagicFileChangeMessage>) => {
			// Resolver handles logging, project match, empty changes, and duplicate seqs.
			const resolvedEvent = resolveProjectAttachmentsChangeEvent({
				seq,
				projectId,
				enabled,
				store,
				currentTraceId: pendingTraceIdRef.current,
			})
			if (!resolvedEvent) return

			const { messageData, dedupeKey, traceId, projectId: eventProjectId } = resolvedEvent
			const changes = Array.isArray(messageData.changes) ? messageData.changes : []

			pendingTraceIdRef.current = pendingTraceIdRef.current || traceId
			pendingChangesRef.current = [...pendingChangesRef.current, ...changes]
			pendingSeqKeysRef.current = [...pendingSeqKeysRef.current, dedupeKey]
			pendingRefreshParentIdsRef.current = normalizeRefreshParentIds([
				...pendingRefreshParentIdsRef.current,
				...normalizeRefreshParentIds(messageData.refresh_parent_ids),
			])
			pendingLastUpdatedAtRef.current =
				messageData.timestamp || pendingLastUpdatedAtRef.current
			projectAttachmentsChangeLog.wsQueued({
				projectId: eventProjectId,
				dedupeKey,
				changeCount: changes.length,
				pendingChangeCount: pendingChangesRef.current.length,
				pendingSeqKeys: pendingSeqKeysRef.current,
				lastUpdatedAt: pendingLastUpdatedAtRef.current,
				traceId: pendingTraceIdRef.current,
			})
			scheduleFlush()
		},
	)

	useEffect(() => {
		if (!enabled || !projectId) {
			projectAttachmentsChangeLog.subscriptionSkipped(projectId, enabled)
			return undefined
		}

		projectAttachmentsChangeLog.subscriptionStarted(projectId, enabled)
		let wasHidden = document.hidden
		const requestResume = () => {
			if (!canRecover || document.hidden || !navigator.onLine) return
			pendingResumeRef.current = true
			scheduleFlush()
		}
		const handleVisibilityChange = () => {
			if (document.hidden) {
				wasHidden = true
				return
			}
			if (!wasHidden) return
			wasHidden = false
			requestResume()
		}
		const handlePageShow = (event: PageTransitionEvent) => {
			if (event.persisted) requestResume()
		}
		document.addEventListener("visibilitychange", handleVisibilityChange)
		window.addEventListener("pageshow", handlePageShow)
		window.addEventListener("online", requestResume)

		pubsub.subscribe(
			PubSubEvents.Super_Magic_File_Change_Intermediate,
			handleFileChangeIntermediate,
		)

		return () => {
			subscriptionVersionRef.current += 1
			pendingResumeRef.current = false
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			window.removeEventListener("pageshow", handlePageShow)
			window.removeEventListener("online", requestResume)
			projectAttachmentsChangeLog.subscriptionStopped(projectId)
			pubsub.unsubscribe(
				PubSubEvents.Super_Magic_File_Change_Intermediate,
				handleFileChangeIntermediate,
			)
			if (timerRef.current) {
				clearTimeout(timerRef.current)
				timerRef.current = null
			}
			abortRefreshParentRequests()
			// Drop unflushed batches on project switch or unmount.
			pendingChangesRef.current = []
			pendingSeqKeysRef.current = []
			pendingRefreshParentIdsRef.current = []
			pendingTraceIdRef.current = ""
			pendingLastUpdatedAtRef.current = ""
			parentMissingRetryCountRef.current = 0
			fallbackRefreshInFlightRef.current = false
		}
	}, [
		abortRefreshParentRequests,
		accessScope,
		canRecover,
		enabled,
		handleFileChangeIntermediate,
		projectId,
		scheduleFlush,
		store,
	])
}
