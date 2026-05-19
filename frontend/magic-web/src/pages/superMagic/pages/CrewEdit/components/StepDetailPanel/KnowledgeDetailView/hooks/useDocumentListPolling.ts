import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { CrewKnowledge } from "@/types/crew-knowledge"

/**
 * 轮询配置
 */
const POLL_CONFIG = {
	/** 轮询间隔(毫秒) */
	interval: 3000,
	/** 最大轮询次数(10分钟) */
	maxAttempts: 200,
}

/**
 * 检查文档是否处于处理中状态
 */
function isDocumentProcessing(syncStatus: CrewKnowledge.DocumentSyncStatus): boolean {
	return (
		syncStatus === CrewKnowledge.DocumentSyncStatus.PENDING ||
		syncStatus === CrewKnowledge.DocumentSyncStatus.SYNCING ||
		syncStatus === CrewKnowledge.DocumentSyncStatus.REBUILDING
	)
}

/**
 * 文档列表轮询Hook参数
 */
export interface UseDocumentListPollingOptions {
	/** 是否启用轮询 */
	enabled: boolean
	/** 文档列表（用于非 fetch 后场景的兜底；fetch 后请优先用 getDocumentList） */
	documentList: Array<{ sync_status: CrewKnowledge.DocumentSyncStatus }>
	/**
	 * 从数据源读取最新列表（如 MobX store），在 onFetchDocuments 之后用于判断是否继续轮询
	 * 若省略则仍用 props 的 documentList，fetch 后可能多一轮轮询
	 */
	getDocumentList?: () => Array<{ sync_status: CrewKnowledge.DocumentSyncStatus }>
	/** 获取文档列表的回调函数 */
	onFetchDocuments: () => Promise<void>
}

/**
 * 文档列表轮询Hook
 * 用于轮询文档列表，直到所有文档都处理完成
 *
 * @param options 配置选项
 */
export function useDocumentListPolling({
	enabled,
	documentList,
	getDocumentList,
	onFetchDocuments,
}: UseDocumentListPollingOptions) {
	const timerRef = useRef<ReturnType<typeof setTimeout>>()
	const attemptsRef = useRef(0)
	const isPollingRef = useRef(false)
	const documentListRef = useRef(documentList)
	const getDocumentListRef = useRef(getDocumentList)
	const lastFetchTimeRef = useRef(0) // 记录上次调用时间

	// 始终更新最新的 documentList 引用
	documentListRef.current = documentList
	getDocumentListRef.current = getDocumentList

	/** fetch 后应用 MobX 已更新，但 React 尚未重渲染，须从 store 取最新列表 */
	const getLatestList = useMemoizedFn(() => {
		return getDocumentListRef.current?.() ?? documentListRef.current
	})

	// 清理定时器
	const clearTimer = useMemoizedFn(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = undefined
		}
	})

	// 停止轮询
	const stopPolling = useMemoizedFn(() => {
		isPollingRef.current = false
		clearTimer()
		attemptsRef.current = 0
	})

	const shouldContinuePolling = useMemoizedFn(() => {
		// fetch 后 React 可能尚未重渲染，须用 getDocumentList 从 store 读最新 sync_status
		const hasProcessingDoc = getLatestList().some((doc) =>
			isDocumentProcessing(doc.sync_status),
		)

		// 没有处理中的文档，停止轮询
		if (!hasProcessingDoc) {
			stopPolling()
			return false
		}

		// 超过最大轮询次数，停止轮询
		if (attemptsRef.current >= POLL_CONFIG.maxAttempts) {
			console.warn("文档列表轮询超时")
			stopPolling()
			return false
		}

		return true
	})

	// 轮询函数
	const poll = useMemoizedFn(async () => {
		if (!isPollingRef.current) return

		// 检查是否刚刚调用过（2秒内），避免重复调用
		const now = Date.now()
		if (now - lastFetchTimeRef.current < 2000) {
			console.log("跳过重复的文档列表请求（距离上次调用不足2秒）")
			// 继续安排下一次轮询
			if (shouldContinuePolling()) {
				timerRef.current = setTimeout(() => {
					void poll()
				}, POLL_CONFIG.interval)
			}
			return
		}

		try {
			lastFetchTimeRef.current = now
			attemptsRef.current += 1
			await onFetchDocuments()

			// 检查是否需要继续轮询
			if (shouldContinuePolling()) {
				timerRef.current = setTimeout(() => {
					void poll()
				}, POLL_CONFIG.interval)
			}
		} catch (error) {
			console.error("轮询文档列表失败:", error)
			// 出错后等待一段时间再重试
			if (shouldContinuePolling()) {
				timerRef.current = setTimeout(() => {
					void poll()
				}, POLL_CONFIG.interval)
			}
		}
	})

	// 开始轮询
	const startPolling = useMemoizedFn(() => {
		if (isPollingRef.current) return

		isPollingRef.current = true
		attemptsRef.current = 0
		void poll()
	})

	// 仅在 enabled 变化时控制轮询启停
	useEffect(() => {
		if (!enabled) {
			stopPolling()
			return
		}

		// 检查是否有处理中的文档
		const hasProcessingDoc = documentList.some((doc) => isDocumentProcessing(doc.sync_status))

		if (hasProcessingDoc && !isPollingRef.current) {
			// 有处理中的文档且未在轮询，开始轮询
			startPolling()
		}
		// 注意：不在这里停止轮询，让 poll 函数内部的 shouldContinuePolling 来判断
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled]) // 移除 documentList 依赖，避免循环

	// 组件卸载时清理
	useEffect(() => {
		return () => {
			stopPolling()
		}
	}, [stopPolling])

	return {
		isPolling: isPollingRef.current,
		startPolling,
		stopPolling,
	}
}
