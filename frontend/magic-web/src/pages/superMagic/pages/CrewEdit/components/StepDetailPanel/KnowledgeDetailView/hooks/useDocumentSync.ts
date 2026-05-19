import { useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import {
	DOCUMENT_SYNC_STATUS,
	POLLING_CONFIG,
	type DocumentSyncStatus,
} from "../constants/document-constants"

/**
 * 文档同步状态轮询Hook
 * 用于在文档创建/重向量化后轮询同步状态
 *
 * 注意：轮询不会自动启动，需要手动调用 startPolling() 触发
 */
export function useDocumentSync(options: {
	knowledgeCode: string | null
	documentCode: string | null
	onSuccess?: () => void
	onError?: (error: string) => void
}) {
	const { knowledgeCode, documentCode, onSuccess, onError } = options
	const { t } = useTranslation("crew/create")

	const [syncStatus, setSyncStatus] = useState<DocumentSyncStatus | null>(null)
	const [isPolling, setIsPolling] = useState(false)
	const timerRef = useRef<ReturnType<typeof setTimeout>>()
	const pollCountRef = useRef(0)
	const pollingDocumentCodeRef = useRef<string | null>(null)

	// 清理定时器
	const clearTimer = useMemoizedFn(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current)
			timerRef.current = undefined
		}
	})

	// 判断是否为处理中状态
	const isProcessingStatus = useMemoizedFn((status: DocumentSyncStatus): boolean => {
		return (
			status === DOCUMENT_SYNC_STATUS.SYNCING ||
			status === DOCUMENT_SYNC_STATUS.PENDING ||
			status === DOCUMENT_SYNC_STATUS.REBUILDING
		)
	})

	// 轮询文档状态
	const poll = useMemoizedFn(async () => {
		const docCode = pollingDocumentCodeRef.current

		if (!knowledgeCode || !docCode) {
			return
		}

		try {
			const detail = await KnowledgeApi.getCrewKnowledgeDocumentDetail({
				knowledge_code: knowledgeCode,
				document_code: docCode,
			})

			setSyncStatus(detail.sync_status)
			pollCountRef.current += 1

			// 成功
			if (detail.sync_status === DOCUMENT_SYNC_STATUS.SYNCED) {
				setIsPolling(false)
				clearTimer()
				onSuccess?.()
				return
			}

			// 失败
			if (
				detail.sync_status === DOCUMENT_SYNC_STATUS.SYNC_FAILED ||
				detail.sync_status === DOCUMENT_SYNC_STATUS.DELETE_FAILED
			) {
				setIsPolling(false)
				clearTimer()
				onError?.(
					detail?.sync_status_message ||
						t("documentCreate.processing.documentProcessingFailed"),
				)
				return
			}

			// 处理中或待处理,继续轮询
			if (isProcessingStatus(detail.sync_status)) {
				// 检查是否超过最大轮询次数
				if (pollCountRef.current < POLLING_CONFIG.MAX_ATTEMPTS) {
					timerRef.current = setTimeout(() => {
						void poll()
					}, POLLING_CONFIG.INTERVAL)
				} else {
					setIsPolling(false)
					clearTimer()
					onError?.(t(POLLING_CONFIG.TIMEOUT_MESSAGE_KEY))
				}
			}
		} catch (error) {
			console.error("Poll document sync status failed:", error)
			setIsPolling(false)
			clearTimer()
			onError?.(t("documentCreate.processing.fetchDocumentStatusFailed"))
		}
	})

	// 开始轮询
	const startPolling = useMemoizedFn((overrideDocumentCode?: string) => {
		// 优先使用传入的 documentCode，否则使用 props 中的
		const codeToUse = overrideDocumentCode || documentCode

		if (!knowledgeCode || !codeToUse) {
			return
		}

		// 保存要轮询的文档 code
		pollingDocumentCodeRef.current = codeToUse
		pollCountRef.current = 0
		setIsPolling(true)
		setSyncStatus(DOCUMENT_SYNC_STATUS.PENDING)
		void poll()
	})

	// 停止轮询
	const stopPolling = useMemoizedFn(() => {
		setIsPolling(false)
		clearTimer()
		pollCountRef.current = 0
		pollingDocumentCodeRef.current = null
	})

	// 清理
	useEffect(() => {
		return () => {
			clearTimer()
		}
	}, [clearTimer])

	return {
		syncStatus,
		isPolling,
		startPolling,
		stopPolling,
	}
}
