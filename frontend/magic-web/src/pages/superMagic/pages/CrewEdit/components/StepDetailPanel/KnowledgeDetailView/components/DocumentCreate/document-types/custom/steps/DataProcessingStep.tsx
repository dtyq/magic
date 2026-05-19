import { observer } from "mobx-react-lite"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { StepNavigation } from "../../../components"
import { ProcessingProgressSection } from "../../../components/shared/ProcessingProgressSection"
import type { CustomContentStore } from "../../../store"
import { createCustomDocument } from "../../../../../utils/documentCreator"
import { buildFragmentConfig } from "../../../utils/strategyConfigConverter"
import { useDocumentSync } from "../../../../../hooks/useDocumentSync"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { KnowledgeApi } from "@/apis"
import { useFileUpload } from "../../local/hooks"

function mapUploadProgressToProcessingStep(progress: number) {
	const normalizedProgress = Math.min(Math.max(progress, 0), 100)
	return 10 + Math.round((normalizedProgress / 100) * 19)
}

const CUSTOM_CONTENT_FILE_ID = "custom-content"

/**
 * DataProcessingStep组件Props
 */
export interface DataProcessingStepProps {
	store: CustomContentStore
	onNext: () => void
	editMode?: boolean
	editDocumentCode?: string | null
}

/**
 * Custom Content第2步：数据处理
 * 显示文档处理进度
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-2085644
 */
export const DataProcessingStep = observer(function DataProcessingStep({
	store,
	onNext,
	editMode = false,
	editDocumentCode = null,
}: DataProcessingStepProps) {
	const { t } = useTranslation("crew/create")

	const { handleFileUpload } = useFileUpload((uid, progress) => {
		if (uid !== CUSTOM_CONTENT_FILE_ID) return
		store.updateCreatedDocumentProgress(mapUploadProgressToProcessingStep(progress))
	})

	// 监听文档同步状态
	const { syncStatus, startPolling, stopPolling } = useDocumentSync({
		knowledgeCode: store.knowledgeCode,
		documentCode: store.createdDocument?.documentCode || null,
	})

	/**
	 * 创建文档
	 */
	const createDocument = useMemoizedFn(async () => {
		if (store.isCreating || store.createdDocument) return

		store.setIsCreating(true)
		store.setCreateError(null)

		// 初始化创建状态
		store.setCreatedDocument({
			fileId: CUSTOM_CONTENT_FILE_ID,
			fileName: store.documentName || t("documentCreate.customContent.title"),
			status: "creating",
			progress: 10,
		})

		try {
			// 步骤1: 先上传文件内容
			// 创建 markdown 文件
			const blob = new Blob([store.documentContent], { type: "text/markdown" })
			const file = new File([blob], `${store.documentName}.md`, { type: "text/markdown" })

			// 上传文件，复用 Local Documents 相同的上传链路
			const uploadResult = await handleFileUpload(file, CUSTOM_CONTENT_FILE_ID)

			if (!uploadResult.success || !uploadResult.path) {
				throw new Error(t("documentCreate.processing.uploadFailed"))
			}

			const fileKey = uploadResult.path

			// 步骤2: 构建 FragmentConfig
			const fragmentConfig = buildFragmentConfig(store.strategyConfig)

			// 步骤3: 构建解析配置
			const isPreciseParsing =
				store.strategyConfig.parsingStrategy === "precise" &&
				store.strategyConfig.enablePreciseParsing

			const parsingConfig = {
				parsingType: isPreciseParsing ? 1 : 0,
				imageExtraction: isPreciseParsing ? store.strategyConfig.extractImages : false,
				tableExtraction: isPreciseParsing ? store.strategyConfig.extractTables : false,
				imageOcr: isPreciseParsing ? store.strategyConfig.extractOCR : false,
			}

			// 步骤4: 调用创建文档API
			const result = await createCustomDocument({
				knowledgeCode: store.knowledgeCode,
				name: store.documentName,
				fileKey,
				fragmentConfig,
				parsingConfig,
			})

			// 更新为创建成功，开始同步
			store.setCreatedDocument({
				fileId: CUSTOM_CONTENT_FILE_ID,
				fileName: store.documentName,
				status: "success",
				progress: 30,
				documentCode: result.code,
				syncStatus: result.sync_status,
			})

			// 创建成功后立即启动轮询，传入 documentCode 避免时序问题
			startPolling(result.code)
		} catch (error) {
			console.error("Create custom document failed:", error)
			const errorMessage =
				error instanceof Error ? error.message : t("documentCreate.processing.createFailed")

			store.setCreatedDocument({
				fileId: CUSTOM_CONTENT_FILE_ID,
				fileName: store.documentName,
				status: "error",
				progress: 0,
				error: errorMessage,
			})
			store.setCreateError(errorMessage || null)
		} finally {
			store.setIsCreating(false)
		}
	})

	/**
	 * 更新文档（编辑模式）
	 */
	const updateDocument = useMemoizedFn(async () => {
		if (store.isCreating || store.createdDocument || !editDocumentCode) return

		store.setIsCreating(true)
		store.setCreateError(null)

		// 初始化更新状态
		store.setCreatedDocument({
			fileId: CUSTOM_CONTENT_FILE_ID,
			fileName: store.documentName || t("documentCreate.customContent.title"),
			status: "creating",
			progress: 10,
			documentCode: editDocumentCode,
		})

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

			// 调用更新文档API（PUT 方法，只更新配置，不重新上传文件）
			const result = await KnowledgeApi.updateCrewKnowledgeDocument({
				knowledge_code: store.knowledgeCode,
				document_code: editDocumentCode,
				name: store.documentName,
				enabled: true,
				fragment_config: fragmentConfig,
				strategy_config: strategyConfig,
				// 编辑模式下不需要传 document_file，后端会使用已有的文件
			})

			// 更新为成功，开始同步
			store.setCreatedDocument({
				fileId: CUSTOM_CONTENT_FILE_ID,
				fileName: store.documentName,
				status: "success",
				progress: 30,
				documentCode: editDocumentCode,
				syncStatus: result.sync_status,
			})

			// 更新成功后立即启动轮询
			startPolling(editDocumentCode)
		} catch (error) {
			console.error("Update custom document failed:", error)
			const errorMessage =
				error instanceof Error ? error.message : t("documentCreate.processing.updateFailed")

			store.setCreatedDocument({
				fileId: CUSTOM_CONTENT_FILE_ID,
				fileName: store.documentName,
				status: "error",
				progress: 0,
				error: errorMessage,
			})
			store.setCreateError(errorMessage || null)
		} finally {
			store.setIsCreating(false)
		}
	})

	// 当同步状态变化时更新store
	useUpdateEffect(() => {
		if (syncStatus !== null) {
			store.updateDocumentSyncStatus(syncStatus)
		}
	}, [syncStatus])

	useEffect(() => {
		// 进入该步骤时自动开始创建或更新文档
		if (!store.createdDocument && !store.isCreating) {
			if (editMode && editDocumentCode) {
				// 编辑模式：更新文档
				updateDocument()
			} else {
				// 创建模式：创建文档
				createDocument()
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 组件卸载时停止轮询
	useEffect(() => {
		return () => {
			stopPolling()
		}
	}, [stopPolling])

	return (
		<div className="flex h-full flex-col">
			{/* 可滚动区域：处理进度 */}
			<div className="min-h-0 flex-1 overflow-y-auto px-8">
				<ProcessingProgressSection
					files={
						store.createdDocument
							? [
									{
										fileId: store.createdDocument.fileId,
										fileName: store.createdDocument.fileName,
										progress: store.createdDocument.progress,
										type: "document",
									},
								]
							: []
					}
					isComplete={store.processingComplete}
					title={t("documentCreate.processing.title")}
					description={t("documentCreate.processing.pleaseWait")}
					showRealTimeUpdates={false}
				/>

				{/* 错误提示 */}
				{store.createError && (
					<div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
						{store.createError}
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
