import { useTranslation } from "react-i18next"
import { AlertCircle, Clock, Loader2, RotateCw } from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { cn } from "@/lib/utils"
import { KnowledgeApi } from "@/apis"

interface DocumentSyncStatusBadgeProps {
	syncStatus: CrewKnowledge.DocumentSyncStatus
	className?: string
	/** 文档 code（失败状态需要用于重试） */
	documentCode?: string
	/** 知识库 code（失败状态需要用于重试） */
	knowledgeBaseCode?: string
	/** 重试成功后的回调（用于刷新文档状态；若为 async 须被 await，否则会先结束 loading 再刷新列表） */
	onRetrySuccess?: () => void | Promise<void>
}

/**
 * 文档同步状态徽章
 * 根据同步状态显示不同的提示
 * 失败状态可点击重试
 */
export function DocumentSyncStatusBadge({
	syncStatus,
	className,
	documentCode,
	knowledgeBaseCode,
	onRetrySuccess,
}: DocumentSyncStatusBadgeProps) {
	const { t } = useTranslation("crew/create")
	const [isRetrying, setIsRetrying] = useState(false)
	/** 重定向 API 已成功但列表接口仍短暂返回失败态时，避免徽章退回「处理失败」直到 store 反映非失败 */
	const [suppressStaleListFailure, setSuppressStaleListFailure] = useState(false)

	useEffect(() => {
		if (!suppressStaleListFailure) return
		if (
			syncStatus !== CrewKnowledge.DocumentSyncStatus.SYNC_FAILED &&
			syncStatus !== CrewKnowledge.DocumentSyncStatus.DELETE_FAILED
		) {
			setSuppressStaleListFailure(false)
		}
	}, [syncStatus, suppressStaleListFailure])

	const displaySyncStatus =
		suppressStaleListFailure &&
		(syncStatus === CrewKnowledge.DocumentSyncStatus.SYNC_FAILED ||
			syncStatus === CrewKnowledge.DocumentSyncStatus.DELETE_FAILED)
			? CrewKnowledge.DocumentSyncStatus.SYNCING
			: syncStatus

	/**
	 * 处理重试
	 */
	const handleRetry = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation() // 阻止事件冒泡

			if (!documentCode || !knowledgeBaseCode || isRetrying) return

			setIsRetrying(true)
			try {
				await KnowledgeApi.revectorizeDocument({
					knowledgeBaseCode,
					documentCode,
					sync: true,
				})
				setSuppressStaleListFailure(true)
				// 必须 await：父组件 onRetrySuccess 常为 async；若不 await，finally 会立刻把 isRetrying 置 false，列表仍为旧 sync_status，出现「处理中→处理失败」闪烁
				await Promise.resolve(onRetrySuccess?.())
			} catch (error) {
				setSuppressStaleListFailure(false)
				console.error("重试失败:", error)
			} finally {
				setIsRetrying(false)
			}
		},
		[documentCode, knowledgeBaseCode, isRetrying, onRetrySuccess],
	)

	// 同步成功时不显示
	if (displaySyncStatus === CrewKnowledge.DocumentSyncStatus.SYNCED) {
		return null
	}

	// 待处理状态
	if (displaySyncStatus === CrewKnowledge.DocumentSyncStatus.PENDING) {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
					className,
				)}
			>
				<Clock className="size-3" />
				{t("documentCreate.processing.statusPending")}
			</span>
		)
	}

	// 处理中状态（包括 SYNCING 和 REBUILDING）
	if (
		displaySyncStatus === CrewKnowledge.DocumentSyncStatus.SYNCING ||
		displaySyncStatus === CrewKnowledge.DocumentSyncStatus.REBUILDING
	) {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
					className,
				)}
			>
				<Loader2 className="size-3 animate-spin" />
				{t("documentCreate.processing.statusProcessing")}
			</span>
		)
	}

	// 失败状态（包括 SYNC_FAILED 和 DELETE_FAILED）
	if (
		displaySyncStatus === CrewKnowledge.DocumentSyncStatus.SYNC_FAILED ||
		displaySyncStatus === CrewKnowledge.DocumentSyncStatus.DELETE_FAILED
	) {
		// 如果有 documentCode 和 knowledgeBaseCode，显示为可点击的重试按钮
		if (documentCode && knowledgeBaseCode) {
			return (
				<button
					type="button"
					onClick={handleRetry}
					disabled={isRetrying}
					className={cn(
						"group inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors",
						isRetrying
							? "cursor-default bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400"
							: cn(
									"bg-destructive/10 text-destructive dark:bg-destructive/20",
									"hover:bg-blue-500/10 hover:text-blue-600 dark:hover:bg-blue-500/20 dark:hover:text-blue-400",
									"disabled:cursor-not-allowed disabled:opacity-50",
								),
						className,
					)}
					title={isRetrying ? undefined : t("knowledgeDetail.retryTooltip")}
				>
					{isRetrying ? (
						<>
							<Loader2 className="size-3 animate-spin" />
							{t("documentCreate.processing.statusProcessing")}
						</>
					) : (
						<>
							<AlertCircle className="size-3 group-hover:hidden" />
							<RotateCw className="hidden size-3 group-hover:block" />
							<span className="group-hover:hidden">
								{t("documentCreate.processing.statusFailed")}
							</span>
							<span className="hidden group-hover:inline">
								{t("knowledgeDetail.revectorize")}
							</span>
						</>
					)}
				</button>
			)
		}

		// 如果没有提供必要参数，只显示失败状态
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive dark:bg-destructive/20",
					className,
				)}
			>
				<AlertCircle className="size-3" />
				{t("documentCreate.processing.statusFailed")}
			</span>
		)
	}

	return null
}
