import { observer } from "mobx-react-lite"
import { useEffect, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { Loader2 } from "lucide-react"
import { StepNavigation } from "../../../components"
import { ProcessingDocumentSyncStatusSection } from "../../../components/shared/ProcessingDocumentSyncStatusSection"
import type { WikiDocumentStore } from "../../../store"
import { KnowledgeApi } from "@/apis"
import magicToast from "@/components/base/MagicToaster/utils"
import {
	buildCrewStrategyConfigForApi,
	buildFragmentConfig,
} from "../../../utils/strategyConfigConverter"
import { CrewKnowledge } from "@/types/crew-knowledge"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useCrewEditStore } from "@/pages/superMagic/pages/CrewEdit/context"
import { calculateProgressFromSyncStatus } from "../../../../../constants/document-constants"

/**
 * DataProcessingStep组件Props
 */
export interface DataProcessingStepProps {
	store: WikiDocumentStore
	onNext: () => void
	onPrevious: () => void
	knowledgeCode?: string
	editDocumentCode?: string | null
}

/**
 * Enterprise Wiki第3步：数据处理
 * 在已有知识库中创建文档并显示处理进度
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2365285
 */
export const DataProcessingStep = observer(function DataProcessingStep({
	store,
	onNext,
	onPrevious,
	knowledgeCode,
	editDocumentCode = null,
}: DataProcessingStepProps) {
	const { t } = useTranslation("crew/create")
	const { knowledge } = useCrewEditStore()

	const [createdDocumentCode, setCreatedDocumentCode] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const [createError, setCreateError] = useState<string | null>(null)

	// 使用 ref 来确保只执行一次创建操作
	const hasInitialized = useRef(false)
	const pollingTimerRef = useRef<ReturnType<typeof setTimeout>>()
	const pollingAttemptsRef = useRef(0)

	// 检查文档是否处于处理中状态
	const isDocumentProcessing = (syncStatus: CrewKnowledge.DocumentSyncStatus): boolean => {
		return (
			syncStatus === CrewKnowledge.DocumentSyncStatus.PENDING ||
			syncStatus === CrewKnowledge.DocumentSyncStatus.SYNCING ||
			syncStatus === CrewKnowledge.DocumentSyncStatus.REBUILDING
		)
	}

	// 根据 sync_status 计算状态
	const getStatusFromSyncStatus = (
		syncStatus: CrewKnowledge.DocumentSyncStatus,
	): "uploading" | "done" | "error" => {
		switch (syncStatus) {
			case CrewKnowledge.DocumentSyncStatus.SYNCED:
				return "done"
			case CrewKnowledge.DocumentSyncStatus.SYNC_FAILED:
			case CrewKnowledge.DocumentSyncStatus.DELETE_FAILED:
			case CrewKnowledge.DocumentSyncStatus.DELETED:
				return "error"
			default:
				return "uploading"
		}
	}

	// 轮询文档列表
	const pollDocumentList = useMemoizedFn(async () => {
		if (!knowledgeCode) return

		try {
			// 静默刷新文档列表
			await knowledge.fetchDocumentList(knowledgeCode, undefined, true, true, true)

			const documentList = knowledge.documentList
			const pollingDocuments = editDocumentCode
				? documentList.filter((doc) => doc.code === editDocumentCode)
				: documentList

			// 更新每个文档的进度和状态
			pollingDocuments.forEach((doc) => {
				const progress = calculateProgressFromSyncStatus(doc.sync_status)
				const status = getStatusFromSyncStatus(doc.sync_status)
				store.updateProcessingProgress(doc.code, progress, status, doc.sync_status)
			})

			// 检查是否所有文档都处理完成
			const hasProcessingDoc = pollingDocuments.some((doc) =>
				isDocumentProcessing(doc.sync_status),
			)

			if (!hasProcessingDoc || pollingAttemptsRef.current >= 200) {
				// 所有文档都处理完成或超时，停止轮询
				store.processingComplete = true
				return
			}

			// 继续轮询
			pollingAttemptsRef.current += 1
			pollingTimerRef.current = setTimeout(() => {
				void pollDocumentList()
			}, 3000)
		} catch (error) {
			console.error("轮询文档列表失败:", error)
			// 出错后等待一段时间再重试
			if (pollingAttemptsRef.current < 200) {
				pollingAttemptsRef.current += 1
				pollingTimerRef.current = setTimeout(() => {
					void pollDocumentList()
				}, 3000)
			}
		}
	})

	/**
	 * 创建文档并开始轮询
	 */
	const createDocument = useMemoizedFn(async () => {
		if (isCreating || createdDocumentCode || !knowledgeCode) return

		setIsCreating(true)
		setCreateError(null)

		try {
			const fragmentConfig = buildFragmentConfig(store.strategyConfig)
			const strategyConfigApi = buildCrewStrategyConfigForApi(store.strategyConfig)

			let processingItems: Array<{
				fileId: string
				fileName: string
				progress: number
				sync_status: CrewKnowledge.DocumentSyncStatus
			}> = []

			if (editDocumentCode) {
				// 编辑：先拉文档详情用于展示名称，再更新单篇配置（不改编知识库 source_bindings）
				await knowledge.fetchDocumentDetail(knowledgeCode, editDocumentCode)
				const docBefore = knowledge.documentDetail
				if (!docBefore || docBefore.code !== editDocumentCode)
					throw new Error(t("documentCreate.processing.cannotGetDetail"))

				const updated = await KnowledgeApi.updateCrewKnowledgeDocument({
					knowledge_code: knowledgeCode,
					document_code: editDocumentCode,
					name: docBefore.name,
					enabled: docBefore.enabled,
					fragment_config: fragmentConfig,
					strategy_config: strategyConfigApi,
				})

				setCreatedDocumentCode(editDocumentCode)
				processingItems = [
					{
						fileId: updated.code,
						fileName: updated.name,
						progress: calculateProgressFromSyncStatus(updated.sync_status),
						sync_status: updated.sync_status,
					},
				]
			} else {
				const sourceBindings = store.buildSourceBindings()

				const result = await KnowledgeApi.updateCrewKnowledge({
					code: knowledgeCode,
					source_type: CrewKnowledge.KnowledgeSourceType.ENTERPRISE_KNOWLEDGE,
					fragment_config: fragmentConfig,
					...(sourceBindings?.length > 0 ? { source_bindings: sourceBindings } : {}),
				})

				if (!result?.code) {
					throw new Error(t("documentCreate.processing.noDocumentCode"))
				}

				setCreatedDocumentCode(result.code)

				await knowledge.fetchDocumentList(knowledgeCode)

				const documentList = knowledge.documentList
				processingItems = documentList.map((doc) => ({
					fileId: doc.code,
					fileName: doc.name,
					progress: calculateProgressFromSyncStatus(doc.sync_status),
					sync_status: doc.sync_status,
				}))
			}

			store.initProcessingFiles(
				processingItems.map(({ fileId, fileName }) => ({ fileId, fileName })),
			)

			processingItems.forEach((file) => {
				store.updateProcessingProgress(
					file.fileId,
					file.progress,
					getStatusFromSyncStatus(file.sync_status),
					file.sync_status,
				)
			})

			// 发布事件，触发知识库列表 polling；完成按钮由轮询将 processingComplete 置为 true 后解锁
			pubsub.publish(PubSubEvents.Trigger_Knowledge_List_Polling)

			// 开始轮询文档列表
			pollingAttemptsRef.current = 0
			void pollDocumentList()
		} catch (error) {
			console.error("创建文档失败:", error)
			const errorMsg =
				error instanceof Error
					? error.message
					: t("documentCreate.processing.createDocumentFailed")
			setCreateError(errorMsg)
			magicToast.error(errorMsg)
		} finally {
			setIsCreating(false)
		}
	})

	// 进入该步骤时自动提交（更新知识库 + 轮询）。依赖 knowledgeCode：避免首次渲染 store 未就绪时仅运行一次 useEffect 导致永远不执行
	useEffect(() => {
		if (hasInitialized.current) return
		if (!knowledgeCode) return
		if (createdDocumentCode || isCreating || createError) return
		hasInitialized.current = true
		void createDocument()
	}, [knowledgeCode, createDocument, createdDocumentCode, isCreating, createError])

	// 组件卸载时清理轮询定时器
	useEffect(() => {
		return () => {
			if (pollingTimerRef.current) {
				clearTimeout(pollingTimerRef.current)
			}
		}
	}, [])

	return (
		<div className="flex h-full flex-col">
			{/* 可滚动区域：处理进度 */}
			<div className="min-h-0 flex-1 overflow-y-auto px-8">
				{createError ? (
					<div className="flex flex-col items-center justify-center py-8">
						<div className="text-sm text-destructive">{createError}</div>
						<button
							type="button"
							onClick={createDocument}
							className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
						>
							{t("documentCreate.processing.retry")}
						</button>
					</div>
				) : isCreating && store.processingFiles.length === 0 && editDocumentCode ? (
					// 编辑：拉取文档详情中（不显示「正在创建」）
					<div className="flex flex-col items-center justify-center gap-4 py-16">
						<Loader2 className="size-12 animate-spin text-muted-foreground" />
						<div className="text-center text-sm text-muted-foreground">
							{t("documentCreate.processing.pleaseWait")}
						</div>
					</div>
				) : isCreating && store.processingFiles.length === 0 ? (
					// 新建：等待创建接口返回
					<div className="flex flex-col items-center justify-center gap-4 py-16">
						<Loader2 className="size-12 animate-spin text-muted-foreground" />
						<div className="text-center">
							<div className="text-base font-medium text-foreground">
								{t("documentCreate.processing.creatingDocuments")}
							</div>
							<div className="mt-2 text-sm text-muted-foreground">
								{t("documentCreate.processing.pleaseWait")}
							</div>
						</div>
					</div>
				) : (
					<ProcessingDocumentSyncStatusSection
						knowledgeBaseCode={knowledgeCode || ""}
						title={t("documentCreate.processing.title")}
						description={t("documentCreate.processing.pleaseWait")}
						onRetrySuccess={
							knowledgeCode
								? async () => {
										await knowledge.fetchDocumentList(
											knowledgeCode,
											undefined,
											false,
											true,
											true,
											true,
										)
										pollingAttemptsRef.current = 0
										void pollDocumentList()
									}
								: undefined
						}
						rows={store.processingFiles.map((f) => ({
							id: f.fileId,
							fileName: f.fileName,
							documentCode: f.fileId,
							syncStatus: f.documentSyncStatus,
							showLoading: f.documentSyncStatus === undefined && f.status !== "error",
						}))}
					/>
				)}
				{store.processingComplete && !createError && (
					<div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
						{t("documentCreate.processing.complete")}
					</div>
				)}
			</div>

			{/* 底部导航 */}
			<div className="shrink-0 px-8 py-8">
				<div className="flex items-center justify-end gap-6">
					{/* 左侧提示文案 */}
					<p className="text-xs leading-none text-neutral-500">
						{t("documentCreate.processing.canLeavePageHint")}
					</p>
					{/* 右侧完成按钮：接口创建成功后即可点，不强制等全部同步/SYNCED */}
					<StepNavigation
						showPrevious={false}
						onPrevious={onPrevious}
						nextText={t("documentCreate.navigation.complete")}
						nextDisabled={isCreating || !createdDocumentCode}
						onNext={onNext}
					/>
				</div>
			</div>
		</div>
	)
})
