import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { AttachmentItem } from "../components/TopicFilesButton/hooks"
import { resolveAttachmentsRefreshWaitersForProject } from "../services/attachmentsTopicSync"
import { projectAttachmentsChangeLog } from "../utils/projectAttachments/changeLogReporter"
import { markProjectAttachmentsLastUpdated } from "../utils/projectAttachments/lastUpdatedCache"
import {
	applyMergedParentRefresh,
	loadRefreshParentChildrenSubtreeFromV2,
	loadRefreshParentFileItemsFromV2,
	normalizeRefreshParentIds,
} from "../utils/projectAttachments/changeRealtimeUtils"

export interface ProjectAttachmentsChangeRealtimeData {
	tree: AttachmentItem[]
	list: AttachmentItem[]
	projectId: string
	source: "ws" | "fallback" | "refresh_parent_ids" | "parent_children_refresh"
	fallbackReason?: string
}

interface ParentRefreshScheduleContext {
	parentItemIds?: string[]
	childrenParentIds?: string[]
	traceId: string
	seqKeys: string[]
	lastUpdatedAt: string
}

interface UseProjectAttachmentsRefreshParentWindowOptions {
	projectId?: string
	store: ProjectFilesStore
	parentRefreshWindowMs: number
	onAttachmentsChange?: (data: ProjectAttachmentsChangeRealtimeData) => void
}

export function useProjectAttachmentsRefreshParentWindow({
	projectId,
	store,
	parentRefreshWindowMs,
	onAttachmentsChange,
}: UseProjectAttachmentsRefreshParentWindowOptions) {
	const currentProjectIdRef = useRef(projectId)
	const parentRefreshControllersRef = useRef<Set<AbortController>>(new Set())
	const parentRefreshWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const windowParentItemIdsRef = useRef<string[]>([])
	const windowChildrenParentIdsRef = useRef<string[]>([])
	const windowRefreshSeqKeysRef = useRef<string[]>([])
	const windowRefreshTraceIdRef = useRef<string>("")
	const windowRefreshLastUpdatedAtRef = useRef<string>("")
	const onAttachmentsChangeRef = useRef(onAttachmentsChange)

	useEffect(() => {
		currentProjectIdRef.current = projectId
	}, [projectId])

	useEffect(() => {
		onAttachmentsChangeRef.current = onAttachmentsChange
	}, [onAttachmentsChange])

	const clearRefreshParentWindow = useMemoizedFn(() => {
		if (parentRefreshWindowTimerRef.current) {
			clearTimeout(parentRefreshWindowTimerRef.current)
			parentRefreshWindowTimerRef.current = null
		}
		windowParentItemIdsRef.current = []
		windowChildrenParentIdsRef.current = []
		windowRefreshSeqKeysRef.current = []
		windowRefreshTraceIdRef.current = ""
		windowRefreshLastUpdatedAtRef.current = ""
	})

	const clearRefreshParentChildrenWindow = clearRefreshParentWindow

	const runMergedParentRefresh = useMemoizedFn(
		async (context: Required<ParentRefreshScheduleContext>) => {
			const refreshProjectId = projectId
			const parentItemIds = normalizeRefreshParentIds(context.parentItemIds)
			const childrenParentIds = normalizeRefreshParentIds(context.childrenParentIds)
			if (
				!refreshProjectId ||
				(parentItemIds.length === 0 && childrenParentIds.length === 0)
			) {
				return
			}

			const controller = new AbortController()
			parentRefreshControllersRef.current.add(controller)
			try {
				const trace = {
					traceId: context.traceId,
					projectId: refreshProjectId,
					seqKeys: context.seqKeys,
					batchSize: parentItemIds.length + childrenParentIds.length,
				}
				const requestOptions = {
					projectId: refreshProjectId,
					signal: controller.signal,
					trace,
				}
				const [parentFileItems, serverItems] = await Promise.all([
					parentItemIds.length > 0
						? loadRefreshParentFileItemsFromV2({
								...requestOptions,
								parentIds: parentItemIds,
							})
						: Promise.resolve([]),
					childrenParentIds.length > 0
						? loadRefreshParentChildrenSubtreeFromV2({
								...requestOptions,
								parentIds: childrenParentIds,
							})
						: Promise.resolve([]),
				])
				if (currentProjectIdRef.current !== refreshProjectId) {
					projectAttachmentsChangeLog.refreshParentIdsSkipped({
						projectId: refreshProjectId,
						parentIds: [...parentItemIds, ...childrenParentIds],
						reason: "stale_project",
						traceId: context.traceId,
					})
					return
				}

				const result = applyMergedParentRefresh({
					projectId: refreshProjectId,
					parentItemIds,
					parentFileItems,
					childrenParentIds,
					serverItems,
					store,
					trace,
				})
				if (!result) return

				markProjectAttachmentsLastUpdated(refreshProjectId, context.lastUpdatedAt)
				resolveAttachmentsRefreshWaitersForProject(refreshProjectId)
				onAttachmentsChangeRef.current?.({
					tree: result.tree,
					list: result.list,
					projectId: refreshProjectId,
					source:
						childrenParentIds.length > 0
							? "parent_children_refresh"
							: "refresh_parent_ids",
				})
			} catch (error) {
				if (controller.signal.aborted) return
				if (currentProjectIdRef.current !== refreshProjectId) return
				projectAttachmentsChangeLog.refreshParentIdsError({
					projectId: refreshProjectId,
					parentIds: [...parentItemIds, ...childrenParentIds],
					traceId: context.traceId,
					error,
				})
			} finally {
				parentRefreshControllersRef.current.delete(controller)
			}
		},
	)

	const scheduleParentRefresh = useMemoizedFn((context: ParentRefreshScheduleContext) => {
		const parentItemIds = normalizeRefreshParentIds(context.parentItemIds)
		const childrenParentIds = normalizeRefreshParentIds(context.childrenParentIds)
		if (parentItemIds.length === 0 && childrenParentIds.length === 0) return

		windowParentItemIdsRef.current = normalizeRefreshParentIds([
			...windowParentItemIdsRef.current,
			...parentItemIds,
		])
		windowChildrenParentIdsRef.current = normalizeRefreshParentIds([
			...windowChildrenParentIdsRef.current,
			...childrenParentIds,
		])
		windowRefreshSeqKeysRef.current = Array.from(
			new Set([...windowRefreshSeqKeysRef.current, ...context.seqKeys]),
		)
		windowRefreshTraceIdRef.current = windowRefreshTraceIdRef.current || context.traceId
		windowRefreshLastUpdatedAtRef.current =
			context.lastUpdatedAt || windowRefreshLastUpdatedAtRef.current

		if (parentRefreshWindowTimerRef.current) {
			clearTimeout(parentRefreshWindowTimerRef.current)
		}
		parentRefreshWindowTimerRef.current = setTimeout(() => {
			parentRefreshWindowTimerRef.current = null
			const pendingParentItemIds = windowParentItemIdsRef.current
			const pendingChildrenParentIds = windowChildrenParentIdsRef.current
			const pendingSeqKeys = windowRefreshSeqKeysRef.current
			const pendingTraceId = windowRefreshTraceIdRef.current
			const pendingLastUpdatedAt = windowRefreshLastUpdatedAtRef.current
			windowParentItemIdsRef.current = []
			windowChildrenParentIdsRef.current = []
			windowRefreshSeqKeysRef.current = []
			windowRefreshTraceIdRef.current = ""
			windowRefreshLastUpdatedAtRef.current = ""

			void runMergedParentRefresh({
				parentItemIds: pendingParentItemIds,
				childrenParentIds: pendingChildrenParentIds,
				traceId: pendingTraceId,
				seqKeys: pendingSeqKeys,
				lastUpdatedAt: pendingLastUpdatedAt,
			})
		}, parentRefreshWindowMs)
	})

	const scheduleRefreshParentIds = useMemoizedFn(
		(
			context: Omit<ParentRefreshScheduleContext, "childrenParentIds"> & {
				parentIds: string[]
			},
		) => {
			scheduleParentRefresh({
				parentItemIds: context.parentIds,
				childrenParentIds: [],
				traceId: context.traceId,
				seqKeys: context.seqKeys,
				lastUpdatedAt: context.lastUpdatedAt,
			})
		},
	)

	const scheduleRefreshParentChildren = useMemoizedFn(
		(
			context: Omit<ParentRefreshScheduleContext, "parentItemIds"> & { parentIds: string[] },
		) => {
			scheduleParentRefresh({
				parentItemIds: [],
				childrenParentIds: context.parentIds,
				traceId: context.traceId,
				seqKeys: context.seqKeys,
				lastUpdatedAt: context.lastUpdatedAt,
			})
		},
	)

	const abortRefreshParentRequests = useMemoizedFn(() => {
		clearRefreshParentWindow()
		parentRefreshControllersRef.current.forEach((controller) => controller.abort())
		parentRefreshControllersRef.current.clear()
	})

	return {
		scheduleParentRefresh,
		scheduleRefreshParentIds,
		scheduleRefreshParentChildren,
		clearRefreshParentWindow,
		clearRefreshParentChildrenWindow,
		abortRefreshParentRequests,
	}
}
