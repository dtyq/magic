import { observer } from "mobx-react-lite"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { StepNavigation, FileUploadCard } from "../../../components"
import type { LocalDocumentStore } from "../../../store"
import { createLocalDocumentsBatch } from "../../../../../utils/documentCreator"
import { buildFragmentConfig } from "../../../utils/strategyConfigConverter"
import { useDocumentBatchSync } from "../../../../../hooks/useDocumentBatchSync"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { KnowledgeApi } from "@/apis"
import {
	calculateProgressFromSyncStatus,
	POLLING_CONFIG,
} from "../../../../../constants/document-constants"

/**
 * DataProcessingStep组件Props
 */
export interface DataProcessingStepProps {
	store: LocalDocumentStore
	onNext: () => void
	editMode?: boolean
	editDocumentCode?: string | null
}

/**
 * Local Documents第4步：数据处理
 * 显示文件处理进度
 */
export const DataProcessingStep = observer(function DataProcessingStep({
	store,
	onNext,
	editMode = false,
	editDocumentCode = null,
}: DataProcessingStepProps) {
	const { t } = useTranslation("crew/create")

	// 使用批量文档同步轮询 hook（创建模式）
	const { startPolling: startBatchPolling, stopPolling: stopBatchPolling } = useDocumentBatchSync(
		{
			knowledgeCode: store.knowledgeCode,
			documents: store.createdDocuments
				.filter((doc) => doc.documentCode && doc.status === "success" && doc.syncStatus)
				.map((doc) => ({
					fileId: doc.fileId,
					documentCode: doc.documentCode as string,
					syncStatus: doc.syncStatus as CrewKnowledge.DocumentSyncStatus,
				})),
			onUpdate: (fileId, syncStatus, progress) => {
				store.updateDocumentCreationStatus(fileId, {
					syncStatus,
					progress,
				})
			},
		},
	)

	// 编辑模式下的轮询逻辑
	const pollingTimerRef = useRef<ReturnType<typeof setTimeout>>()
	const pollCountRef = useRef(0)

	const clearPollingTimer = useMemoizedFn(() => {
		if (pollingTimerRef.current) {
			clearTimeout(pollingTimerRef.current)
			pollingTimerRef.current = undefined
		}
	})

	const pollEditModeDocument = useMemoizedFn(async () => {
		if (!editDocumentCode || !store.knowledgeCode) return

		try {
			const detail = await KnowledgeApi.getCrewKnowledgeDocumentDetail({
				knowledge_code: store.knowledgeCode,
				document_code: editDocumentCode,
			})

			const syncStatus = detail.sync_status
			const progress = calculateProgressFromSyncStatus(syncStatus)

			// 更新文档状态
			if (store.createdDocuments.length > 0) {
				store.updateDocumentCreationStatus(store.createdDocuments[0].fileId, {
					syncStatus,
					progress,
				})
			}

			// 判断是否继续轮询
			if (
				syncStatus === CrewKnowledge.DocumentSyncStatus.PENDING ||
				syncStatus === CrewKnowledge.DocumentSyncStatus.SYNCING ||
				syncStatus === CrewKnowledge.DocumentSyncStatus.REBUILDING
			) {
				if (pollCountRef.current < POLLING_CONFIG.MAX_ATTEMPTS) {
					pollCountRef.current += 1
					pollingTimerRef.current = setTimeout(() => {
						void pollEditModeDocument()
					}, POLLING_CONFIG.INTERVAL)
				} else {
					// 超时
					clearPollingTimer()
				}
			} else {
				// 完成或失败，停止轮询
				clearPollingTimer()
			}
		} catch (error) {
			console.error("Poll edit mode document failed:", error)
			clearPollingTimer()
		}
	})

	const startEditModePolling = useMemoizedFn(() => {
		pollCountRef.current = 0
		// 延迟1秒后开始第一次轮询
		pollingTimerRef.current = setTimeout(() => {
			void pollEditModeDocument()
		}, 1000)
	})

	/**
	 * 批量创建文档（创建模式）
	 */
	const createDocuments = useMemoizedFn(async () => {
		if (store.isCreating || store.createdDocuments.length > 0) return

		// 初始化创建文档列表
		store.initCreatedDocuments()
		store.setIsCreating(true)

		try {
			// 构建 FragmentConfig
			const fragmentConfig = buildFragmentConfig(store.strategyConfig)

			// 准备文件列表
			const filesToCreate = store.uploadedFiles
				.filter((f) => f.status === "done" && f.key)
				.map((f) => ({
					fileId: f.uid,
					fileName: f.name,
					fileKey: f.key as string,
				}))

			// 构建解析配置
			const isPreciseParsing =
				store.strategyConfig.parsingStrategy === "precise" &&
				store.strategyConfig.enablePreciseParsing

			const parsingConfig = {
				parsingType: isPreciseParsing ? 1 : 0,
				imageExtraction: isPreciseParsing ? store.strategyConfig.extractImages : false,
				tableExtraction: isPreciseParsing ? store.strategyConfig.extractTables : false,
				imageOcr: isPreciseParsing ? store.strategyConfig.extractOCR : false,
			}

			// 批量创建文档
			const { succeeded, failed } = await createLocalDocumentsBatch(
				store.knowledgeCode,
				filesToCreate,
				fragmentConfig,
				parsingConfig,
			)

			// 更新成功的文档状态
			succeeded.forEach(({ fileId, document }) => {
				store.updateDocumentCreationStatus(fileId, {
					status: "success",
					progress: 30,
					documentCode: document.code,
					syncStatus: document.sync_status,
				})
			})

			// 更新失败的文档状态
			failed.forEach(({ fileId, error }) => {
				store.updateDocumentCreationStatus(fileId, {
					status: "error",
					progress: 0,
					error: error instanceof Error ? error.message : String(error),
				})
			})

			// 开始轮询同步状态
			startBatchPolling()
		} catch (error) {
			console.error("Batch create documents failed:", error)
		} finally {
			store.setIsCreating(false)
		}
	})

	/**
	 * 重新向量化文档（编辑模式）
	 */
	const revectorizeDocument = useMemoizedFn(async () => {
		if (store.isCreating || store.createdDocuments.length > 0 || !editDocumentCode) return

		// 初始化处理状态（编辑模式下只有一个文档）
		const fileName = store.uploadedFiles[0]?.name || "Document"
		store.createdDocuments = [
			{
				fileId: "edit-doc",
				fileName,
				status: "creating",
				progress: 30,
				documentCode: editDocumentCode,
			},
		]
		store.setIsCreating(true)

		try {
			// 构建 FragmentConfig（与预览接口保持一致）
			const fragmentConfig = buildFragmentConfig(store.strategyConfig)

			// 构建解析配置（与预览接口保持一致）
			const isPreciseParsing =
				store.strategyConfig.parsingStrategy === "precise" &&
				store.strategyConfig.enablePreciseParsing

			const strategyConfig: CrewKnowledge.StrategyConfig = {
				parsing_type: isPreciseParsing ? 1 : 0,
				image_extraction: isPreciseParsing ? store.strategyConfig.extractImages : false,
				table_extraction: isPreciseParsing ? store.strategyConfig.extractTables : false,
				image_ocr: isPreciseParsing ? store.strategyConfig.extractOCR : false,
			}

			// 调用更新文档接口（PUT 方法，只更新配置，不重新上传文件）
			const result = await KnowledgeApi.updateCrewKnowledgeDocument({
				knowledge_code: store.knowledgeCode,
				document_code: editDocumentCode,
				name: fileName,
				enabled: true,
				fragment_config: fragmentConfig,
				strategy_config: strategyConfig,
				// 编辑模式下不需要传 document_file，后端会使用已有的文件
			})

			// 更新状态为成功
			store.updateDocumentCreationStatus("edit-doc", {
				status: "success",
				progress: 30,
				documentCode: editDocumentCode,
				syncStatus: result.sync_status,
			})

			// 开始轮询同步状态
			startEditModePolling()
		} catch (error) {
			console.error("Update document failed:", error)
			store.updateDocumentCreationStatus("edit-doc", {
				status: "error",
				progress: 0,
				error: error instanceof Error ? error.message : String(error),
			})
		} finally {
			store.setIsCreating(false)
		}
	})

	useEffect(() => {
		// 进入该步骤时自动开始创建或重新向量化文档
		if (store.createdDocuments.length === 0 && !store.isCreating) {
			if (editMode && editDocumentCode) {
				// 编辑模式：重新向量化
				revectorizeDocument()
			} else {
				// 创建模式：批量创建
				createDocuments()
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 组件卸载时停止轮询
	useEffect(() => {
		return () => {
			stopBatchPolling()
			clearPollingTimer()
		}
	}, [stopBatchPolling, clearPollingTimer])

	return (
		<div className="flex h-full flex-col">
			{/* 可滚动区域：处理进度列表 */}
			<div className="min-h-0 flex-1 overflow-y-auto px-8">
				<div className="flex flex-col gap-2">
					{store.createdDocuments.map((doc) => (
						<FileUploadCard
							key={doc.fileId}
							file={{
								name: doc.fileName,
								status:
									doc.status === "success"
										? "done"
										: doc.status === "error"
											? "error"
											: "uploading",
								progress: doc.progress,
							}}
							showProgress
						/>
					))}
				</div>

				{/* 完成提示 */}
				{store.processingComplete && (
					<div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
						{t("documentCreate.processing.complete")}
					</div>
				)}
			</div>

			{/* 底部导航 - 最后一步不允许返回 */}
			<div className="shrink-0 px-8 py-8">
				<StepNavigation
					showPrevious={false}
					nextText={t("documentCreate.navigation.complete")}
					nextDisabled={!store.processingComplete}
					nextLoading={store.isCreating || !store.processingComplete}
					onNext={onNext}
				/>
			</div>
		</div>
	)
})
