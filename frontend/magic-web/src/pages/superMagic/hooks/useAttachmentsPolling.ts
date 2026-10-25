import { useEffect, useRef, useCallback } from "react"
import { useDebounceFn } from "ahooks"
import { SuperMagicApi } from "@/apis"
import { measureManualPerfAsyncOperation } from "@/utils/manualPerfLogger"
import projectFilesStoreDefault, { type ProjectFilesStore } from "@/stores/projectFiles"
import type { AttachmentItem } from "../components/TopicFilesButton/hooks"
import { measureAttachmentFetch } from "../utils/attachmentPerf"
import { loadProjectAttachments } from "../services/projectAttachmentsLoader"
import {
	clearProjectAttachmentsLastUpdated,
	getProjectAttachmentsLastUpdated,
	markProjectAttachmentsLastUpdated,
	subscribeProjectAttachmentsLastUpdated,
} from "../utils/projectAttachments/lastUpdatedCache"
import { isAbortError, useLatestAbortableRequest } from "./useLatestAbortableRequest"

interface UseAttachmentsPollingOptions {
	/** 项目ID */
	projectId?: string
	/** Source of the current local attachment list. Defaults to the global project file store. */
	store?: Pick<ProjectFilesStore, "workspaceFilesList">
	/** 轮询间隔，默认5秒 */
	interval?: number
	/** 是否启用轮询，默认true */
	enabled?: boolean
	/** Whether to auto-start polling; manual checks still work when false. */
	autoStart?: boolean
	/** 当附件发生变化时的回调函数 */
	onAttachmentsChange?: (data: {
		tree: AttachmentItem[]
		list: AttachmentItem[]
		last_updated_at: string
		projectId: string
	}) => void
	/** 错误回调 */
	onError?: (error: unknown, projectId: string) => void
}

export interface AttachmentsResponse {
	tree?: AttachmentItem[]
	list?: AttachmentItem[]
	last_updated_at?: string
}

/**
 * Fallback attachment consistency check hook.
 * Event-driven pages call checkNow/checkNowDebounced after task terminal status changes.
 * startPolling remains available only for explicit legacy callers.
 */
export function useAttachmentsPolling(options: UseAttachmentsPollingOptions = {}) {
	const {
		projectId,
		store = projectFilesStoreDefault,
		interval = 5000, // 默认5秒，仅显式开启轮询时使用
		enabled = true,
		autoStart = false,
		onAttachmentsChange,
		onError,
	} = options

	const timerRef = useRef<NodeJS.Timeout | null>(null)
	const isMountedRef = useRef(true)
	const { startRequest: startPollingRequest, cancelCurrent: cancelPollingRequest } =
		useLatestAbortableRequest()
	// 每个实例独立跟踪 last_updated_at，避免共享缓存导致多实例间"吞掉"变更通知
	const instanceLastUpdatedRef = useRef<string>("")

	const checkAttachments = useCallback(async () => {
		if (!projectId || !enabled) return

		// Capture projectId at start so stale results after project switches can be dropped.
		const currentProjectId = projectId
		const request = startPollingRequest()
		const isLatestRequest = () =>
			isMountedRef.current && currentProjectId === projectId && request.isCurrent()

		try {
			const countRes = await measureManualPerfAsyncOperation(
				"attachments_count_probe_ms",
				() =>
					SuperMagicApi.getProjectAttachmentsCount(
						{
							projectId: currentProjectId,
						},
						{ signal: request.signal },
					),
				{
					source: "useAttachmentsPolling.getProjectAttachmentsCount",
					has_project_id: true,
				},
			)

			if (!isLatestRequest()) {
				console.log("ProjectId changed during count API call, ignoring result:", {
					started: currentProjectId,
					current: projectId,
				})
				return
			}

			const serverCount = Number(countRes?.total ?? 0)
			const localCount = store.workspaceFilesList.length
			let shouldRefresh = serverCount !== localCount
			let newLastUpdatedAt = instanceLastUpdatedRef.current
			const shouldHydrateLastUpdatedAfterRefresh = shouldRefresh

			if (!shouldRefresh) {
				const res: { last_updated_at: string } = await measureManualPerfAsyncOperation(
					"last_update_fetch_ms",
					() =>
						SuperMagicApi.getLastFileUpdateTime(
							{
								project_id: currentProjectId,
							},
							{ signal: request.signal },
						),
					{
						source: "useAttachmentsPolling.getLastFileUpdateTime",
						has_project_id: true,
					},
				)

				if (!isLatestRequest()) {
					console.log(
						"ProjectId changed during last updated API call, ignoring result:",
						{
							started: currentProjectId,
							current: projectId,
						},
					)
					return
				}

				newLastUpdatedAt = res?.last_updated_at || ""
				const cachedLastUpdatedAt = instanceLastUpdatedRef.current
				shouldRefresh = Boolean(
					newLastUpdatedAt && newLastUpdatedAt !== cachedLastUpdatedAt,
				)
			}

			// Load the tree only when count or last_updated_at changes; otherwise this is a cheap probe.
			if (shouldRefresh) {
				const attachmentRes: AttachmentsResponse = await measureAttachmentFetch(
					"useAttachmentsPolling.loadProjectAttachments",
					() =>
						loadProjectAttachments({
							projectId: currentProjectId,
							signal: request.signal,
						}),
				)

				if (!isLatestRequest()) {
					console.log("ProjectId changed during attachments API call, ignoring result:", {
						started: currentProjectId,
						current: projectId,
					})
					return
				}

				if (shouldHydrateLastUpdatedAfterRefresh) {
					try {
						const res: { last_updated_at: string } =
							await measureManualPerfAsyncOperation(
								"last_update_fetch_ms",
								() =>
									SuperMagicApi.getLastFileUpdateTime(
										{
											project_id: currentProjectId,
										},
										{ signal: request.signal },
									),
								{
									source: "useAttachmentsPolling.getLastFileUpdateTimeAfterCountRefresh",
									has_project_id: true,
								},
							)

						if (!isLatestRequest()) {
							console.log(
								"ProjectId changed during post-refresh last updated API call, ignoring result:",
								{
									started: currentProjectId,
									current: projectId,
								},
							)
							return
						}

						newLastUpdatedAt = res?.last_updated_at || newLastUpdatedAt
					} catch (error) {
						if (isAbortError(error) || !isLatestRequest()) return
						console.warn(
							`Failed to hydrate last_updated_at after count refresh for project ${currentProjectId}:`,
							error,
						)
					}
				}

				// Update the cache only after a successful load so canceled requests cannot hide changes.
				instanceLastUpdatedRef.current = newLastUpdatedAt
				markProjectAttachmentsLastUpdated(currentProjectId, newLastUpdatedAt)

				// 触发回调
				onAttachmentsChange?.({
					tree: attachmentRes?.tree || [],
					list: attachmentRes?.list || [],
					last_updated_at: newLastUpdatedAt,
					projectId: currentProjectId,
				})
			}
		} catch (error) {
			if (isAbortError(error)) return

			if (!isLatestRequest()) {
				console.log("ProjectId changed during API call, ignoring error:", {
					started: currentProjectId,
					current: projectId,
				})
				return
			}

			console.error(`Failed to check attachments for project ${currentProjectId}:`, error)
			onError?.(error, currentProjectId)
		} finally {
			request.release()
		}
	}, [projectId, enabled, onAttachmentsChange, onError, startPollingRequest, store])

	const checkAttachmentsDebounced = useDebounceFn(checkAttachments, {
		wait: 1000,
	}).run

	const startPolling = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
		}

		if (!projectId || !enabled) return

		// Do not run immediately; page initialization owns the first attachment load.
		// checkAttachments()

		timerRef.current = setInterval(checkAttachments, interval)
	}, [checkAttachments, interval, projectId, enabled])

	const stopPolling = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
	}, [])

	// Restart or stop polling when projectId/enabled/autoStart changes.
	useEffect(() => {
		cancelPollingRequest()
		// Reset instance cache on project change; reuse shared cache if WS updated it.
		instanceLastUpdatedRef.current = getProjectAttachmentsLastUpdated(projectId)
		// // 清空文件状态
		// onAttachmentsChange?.({
		// 	tree: [],
		// 	list: [],
		// 	last_updated_at: "",
		// 	projectId: projectId || "",
		// })
		if (projectId && enabled && autoStart) {
			startPolling()
		} else {
			stopPolling()
		}

		return () => {
			cancelPollingRequest()
			stopPolling()
		}
	}, [autoStart, cancelPollingRequest, enabled, projectId, startPolling, stopPolling])

	useEffect(() => {
		return subscribeProjectAttachmentsLastUpdated(projectId, (lastUpdatedAt) => {
			instanceLastUpdatedRef.current = lastUpdatedAt
		})
	}, [projectId])

	// 组件卸载时清理
	useEffect(() => {
		isMountedRef.current = true

		return () => {
			isMountedRef.current = false
			cancelPollingRequest()
			stopPolling()
		}
	}, [cancelPollingRequest, stopPolling])

	return {
		/** 手动触发一次检查 */
		checkNow: checkAttachments,
		// 防抖触发一次检查
		checkNowDebounced: checkAttachmentsDebounced,
		/** 开始轮询 */
		startPolling,
		/** 停止轮询 */
		stopPolling,
		/** 清除指定项目的缓存 */
		clearCache: useCallback(
			(targetProjectId?: string) => {
				// 清除实例级缓存
				instanceLastUpdatedRef.current = ""
				if (targetProjectId) {
					clearProjectAttachmentsLastUpdated(targetProjectId)
				} else if (projectId) {
					clearProjectAttachmentsLastUpdated(projectId)
				}
			},
			[projectId],
		),
		/** 获取指定项目的缓存last_updated_at */
		getCachedLastUpdatedAt: useCallback(
			(targetProjectId?: string) => {
				return (
					instanceLastUpdatedRef.current ||
					getProjectAttachmentsLastUpdated(targetProjectId || projectId)
				)
			},
			[projectId],
		),
	}
}
