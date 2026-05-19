import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"

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
 * 检查知识库是否处于处理中状态
 * 当 completed_count < expected_count 时表示还在处理中
 */
function isKnowledgeProcessing(knowledge: {
	expected_count: number
	completed_count: number
}): boolean {
	return knowledge.completed_count < knowledge.expected_count
}

/**
 * 计算知识库处理进度
 * @returns 0-100 的整数
 */
export function calculateKnowledgeProgress(knowledge: {
	expected_count: number
	completed_count: number
}): number {
	if (knowledge.expected_count === 0) return 100

	const progress = (knowledge.completed_count / knowledge.expected_count) * 100
	return Math.min(Math.round(progress), 100)
}

/**
 * 知识库列表轮询Hook参数
 */
export interface UseKnowledgeListPollingOptions {
	/** 是否启用轮询 */
	enabled: boolean
	/** 知识库列表 */
	knowledgeList: Array<{
		code: string
		expected_count: number
		completed_count: number
	}>
	/** 获取知识库列表的回调函数 */
	onFetchKnowledgeList: () => Promise<void>
}

/**
 * 知识库列表轮询Hook
 * 用于轮询知识库列表，直到所有知识库都处理完成
 *
 * @param options 配置选项
 */
export function useKnowledgeListPolling({
	enabled,
	knowledgeList,
	onFetchKnowledgeList,
}: UseKnowledgeListPollingOptions) {
	const timerRef = useRef<ReturnType<typeof setTimeout>>()
	const attemptsRef = useRef(0)
	const isPollingRef = useRef(false)
	const knowledgeListRef = useRef(knowledgeList)

	// 始终更新最新的 knowledgeList 引用
	knowledgeListRef.current = knowledgeList

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

	// 检查是否需要继续轮询（不使用 useMemoizedFn，直接读取 ref）
	const shouldContinuePolling = () => {
		// 检查是否有知识库处于处理中状态
		const hasProcessingKb = knowledgeListRef.current.some((kb) => isKnowledgeProcessing(kb))

		// 没有处理中的知识库，停止轮询
		if (!hasProcessingKb) {
			stopPolling()
			return false
		}

		// 超过最大轮询次数，停止轮询
		if (attemptsRef.current >= POLL_CONFIG.maxAttempts) {
			console.warn("知识库列表轮询超时")
			stopPolling()
			return false
		}

		return true
	}

	// 轮询函数
	const poll = useMemoizedFn(async () => {
		if (!isPollingRef.current) return

		try {
			attemptsRef.current += 1
			await onFetchKnowledgeList()

			// 检查是否需要继续轮询
			if (shouldContinuePolling()) {
				timerRef.current = setTimeout(() => {
					void poll()
				}, POLL_CONFIG.interval)
			}
		} catch (error) {
			console.error("轮询知识库列表失败:", error)
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

		// 检查是否有处理中的知识库
		const hasProcessingKb = knowledgeList.some((kb) => isKnowledgeProcessing(kb))

		if (hasProcessingKb && !isPollingRef.current) {
			// 有处理中的知识库且未在轮询，开始轮询
			startPolling()
		}
		// 注意：不在这里停止轮询，让 poll 函数内部的 shouldContinuePolling 来判断
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled]) // 移除 knowledgeList 依赖，避免循环

	// 组件卸载时清理
	useEffect(() => {
		return () => {
			stopPolling()
		}
	}, [stopPolling])

	return {
		isPolling: isPollingRef.current,
		stopPolling,
	}
}
