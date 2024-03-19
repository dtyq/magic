import { useEffect, useRef, useCallback } from "react"
import { useDebounceFn } from "ahooks"
import { SuperMagicApi } from "@/opensource/apis"

// 内存缓存Map，记录每个projectId对应的last_updated_at值
const projectLastUpdatedCache = new Map<string, string>()

interface UseAttachmentsPollingOptions {
	/** 项目ID */
	projectId?: string
	/** 轮询间隔，默认5秒 */
	interval?: number
	/** 是否启用轮询，默认true */
	enabled?: boolean
	/** 当附件发生变化时的回调函数 */
	onAttachmentsChange?: (data: {
		tree: any[]
		list: never[]
		last_updated_at: string
		projectId: string
	}) => void
	/** 错误回调 */
	onError?: (error: any, projectId: string) => void
}

export interface AttachmentsResponse {
	tree?: any[]
	list?: never[]
	last_updated_at?: string
}

/**
 * 轮询项目附件状态变化的hook
 * 每5秒检查一次附件的last_updated_at是否发生变化，如果变化则触发回调
 */
export function useAttachmentsPolling(options: UseAttachmentsPollingOptions = {}) {
	const {
		projectId,
		interval = 10000, // 默认10秒
		enabled = true,
		onAttachmentsChange,
		onError,
	} = options

	const timerRef = useRef<NodeJS.Timeout | null>(null)
	const isMountedRef = useRef(true)

	const checkAttachments = useCallback(async () => {
		if (!projectId || !enabled) return

		// 记录开始执行时的projectId，用于后续一致性检查
		const currentProjectId = projectId

		try {
			const res: { last_updated_at: string } = await SuperMagicApi.getLastFileUpdateTime({
				project_id: currentProjectId,
			})

			// 组件已卸载，直接返回
			if (!isMountedRef.current) return

			// 检查projectId是否仍然一致，避免使用过期的projectId处理数据
			if (currentProjectId !== projectId) {
				console.log("ProjectId changed during API call, ignoring result:", {
					started: currentProjectId,
					current: projectId,
				})
				return
			}

			const newLastUpdatedAt = res?.last_updated_at || ""
			const cachedLastUpdatedAt = projectLastUpdatedCache.get(currentProjectId)

			// 如果last_updated_at发生变化或首次获取，触发回调
			if (newLastUpdatedAt && newLastUpdatedAt !== cachedLastUpdatedAt) {
				// 更新缓存
				projectLastUpdatedCache.set(currentProjectId, newLastUpdatedAt)
				const attachmentRes: AttachmentsResponse =
					await SuperMagicApi.getAttachmentsByProjectId({
						projectId: currentProjectId,
						// @ts-ignore 使用window添加临时的token
						temporaryToken: window.temporary_token || "",
					})

				// 再次检查projectId一致性，确保回调时projectId仍然正确
				if (currentProjectId !== projectId) {
					console.log("ProjectId changed during attachments API call, ignoring result:", {
						started: currentProjectId,
						current: projectId,
					})
					return
				}

				// 触发回调
				onAttachmentsChange?.({
					tree: attachmentRes?.tree || [],
					list: attachmentRes?.list || [],
					last_updated_at: newLastUpdatedAt,
					projectId: currentProjectId,
				})
			}
		} catch (error) {
			// 组件已卸载，直接返回
			if (!isMountedRef.current) return

			// 检查projectId一致性，避免报告过期projectId的错误
			if (currentProjectId !== projectId) {
				console.log("ProjectId changed during API call, ignoring error:", {
					started: currentProjectId,
					current: projectId,
				})
				return
			}

			console.error(`Failed to check attachments for project ${currentProjectId}:`, error)
			onError?.(error, currentProjectId)
		}
	}, [projectId, enabled, onAttachmentsChange, onError])

	const checkAttachmentsDebounced = useDebounceFn(checkAttachments, {
		wait: 1000,
	}).run

	const startPolling = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
		}

		if (!projectId || !enabled) return

		// 立即执行一次检查
		// checkAttachments()

		// 启动定时器
		timerRef.current = setInterval(checkAttachments, interval)
	}, [checkAttachments, interval, projectId, enabled])

	const stopPolling = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
	}, [])

	// 当projectId或enabled状态变化时，重新启动轮询
	useEffect(() => {
		// // 清空文件状态
		// onAttachmentsChange?.({
		// 	tree: [],
		// 	list: [],
		// 	last_updated_at: "",
		// 	projectId: projectId || "",
		// })
		if (projectId && enabled) {
			startPolling()
		} else {
			stopPolling()
		}

		return () => {
			stopPolling()
		}
	}, [projectId])

	// 组件卸载时清理
	useEffect(() => {
		isMountedRef.current = true

		return () => {
			isMountedRef.current = false
			stopPolling()
		}
	}, [stopPolling])

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
				if (targetProjectId) {
					projectLastUpdatedCache.delete(targetProjectId)
				} else if (projectId) {
					projectLastUpdatedCache.delete(projectId)
				}
			},
			[projectId],
		),
		/** 获取指定项目的缓存last_updated_at */
		getCachedLastUpdatedAt: useCallback(
			(targetProjectId?: string) => {
				return projectLastUpdatedCache.get(targetProjectId || projectId || "")
			},
			[projectId],
		),
	}
}
