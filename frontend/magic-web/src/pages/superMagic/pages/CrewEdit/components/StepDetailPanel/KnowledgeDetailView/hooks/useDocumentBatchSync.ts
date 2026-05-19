import { useEffect, useRef, useCallback } from "react"
import { useMemoizedFn } from "ahooks"
import { KnowledgeApi } from "@/apis"
import {
	DOCUMENT_SYNC_STATUS,
	POLLING_CONFIG,
	calculateProgressFromSyncStatus,
	type DocumentSyncStatus,
} from "../constants/document-constants"

/**
 * 批量文档同步状态轮询Hook
 * 用于在批量创建文档后同时轮询多个文档的同步状态
 *
 * 注意：轮询不会自动启动，需要手动调用 startPolling() 触发
 */
export interface DocumentItem {
	fileId: string
	documentCode: string
	syncStatus: DocumentSyncStatus
}

export interface UseDocumentBatchSyncOptions {
	knowledgeCode: string | null
	documents: DocumentItem[]
	onUpdate: (fileId: string, syncStatus: DocumentSyncStatus, progress: number) => void
}

export function useDocumentBatchSync(options: UseDocumentBatchSyncOptions) {
	const { knowledgeCode, documents, onUpdate } = options

	const timerRef = useRef<ReturnType<typeof setTimeout>>()
	const pollCountRef = useRef(0)

	// 清理定时器
	const clearTimer = useMemoizedFn(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = undefined
		}
	})

	// 判断是否为终止状态（与 CrewKnowledge.DocumentSyncStatus 一致）
	const isTerminalStatus = useMemoizedFn((status: DocumentSyncStatus): boolean => {
		return (
			status === DOCUMENT_SYNC_STATUS.SYNCED ||
			status === DOCUMENT_SYNC_STATUS.SYNC_FAILED ||
			status === DOCUMENT_SYNC_STATUS.DELETE_FAILED ||
			status === DOCUMENT_SYNC_STATUS.DELETED
		)
	})

	// 轮询批量文档状态
	const poll = useMemoizedFn(async () => {
		if (!knowledgeCode || documents.length === 0) {
			return
		}

		// 筛选出需要轮询的文档（非终止状态）
		const pendingDocs = documents.filter((doc) => !isTerminalStatus(doc.syncStatus))

		if (pendingDocs.length === 0) {
			// 所有文档都完成了
			clearTimer()
			return
		}

		try {
			// 并行查询所有待处理文档的状态
			await Promise.all(
				pendingDocs.map(async (doc) => {
					try {
						const detail = await KnowledgeApi.getCrewKnowledgeDocumentDetail({
							knowledge_code: knowledgeCode,
							document_code: doc.documentCode,
						})

						const newSyncStatus = detail.sync_status
						const progress = calculateProgressFromSyncStatus(newSyncStatus)

						// 回调更新状态
						onUpdate(doc.fileId, newSyncStatus, progress)
					} catch (error) {
						console.error(`Poll document ${doc.documentCode} failed:`, error)
					}
				}),
			)

			pollCountRef.current += 1

			// 继续轮询（如果还有待处理文档且未超过最大次数）
			const stillPending = documents.some((doc) => !isTerminalStatus(doc.syncStatus))
			if (stillPending && pollCountRef.current < POLLING_CONFIG.MAX_ATTEMPTS) {
				timerRef.current = setTimeout(() => {
					void poll()
				}, POLLING_CONFIG.INTERVAL)
			} else if (pollCountRef.current >= POLLING_CONFIG.MAX_ATTEMPTS) {
				clearTimer()
			}
		} catch (error) {
			console.error("Batch poll documents failed:", error)
			clearTimer()
		}
	})

	// 开始轮询
	const startPolling = useCallback(() => {
		if (!knowledgeCode || documents.length === 0) {
			return
		}

		pollCountRef.current = 0
		clearTimer()
		void poll()
	}, [knowledgeCode, documents.length, clearTimer, poll])

	// 停止轮询
	const stopPolling = useMemoizedFn(() => {
		clearTimer()
		pollCountRef.current = 0
	})

	// 清理
	useEffect(() => {
		return () => {
			clearTimer()
		}
	}, [clearTimer])

	return {
		startPolling,
		stopPolling,
	}
}
