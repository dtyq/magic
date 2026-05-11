import { useState, useEffect } from "react"
import { DocumentCreateStore, StrategyConfig } from "../store"
import { PREPROCESSING_RULES, type DocumentType, type PreprocessingRule } from "../constants"
import { useCrewEditStore } from "@/pages/superMagic/pages/CrewEdit/context"
import { UPLOAD_STATUS } from "../constants"
import { KnowledgeApi } from "@/apis"
import { downloadFileContent } from "@/pages/superMagic/utils/api"

/**
 * Hook: 管理 DocumentCreateStore 实例
 *
 * 确保每次组件渲染时使用同一个 store 实例
 *
 * @param knowledgeCode - 知识库代码
 * @param documentType - 文档类型
 * @param editMode - 是否为编辑模式
 * @param editDocumentCode - 编辑模式下的文档代码
 * @returns DocumentCreateStore 实例
 */
export function useDocumentCreateStore(
	knowledgeCode: string,
	documentType: DocumentType,
	editMode = false,
	editDocumentCode?: string | null,
) {
	const { knowledge: knowledgeStore } = useCrewEditStore()
	const [store] = useState(() => {
		const newStore = new DocumentCreateStore(knowledgeCode, editMode, editDocumentCode || null)
		if (documentType) {
			newStore.setDocumentType(documentType)
		}
		return newStore
	})

	// 编辑模式下，预填充文档数据
	useEffect(() => {
		if (!editMode || !editDocumentCode) return

		const documentDetail = knowledgeStore.documentDetail
		if (!documentDetail || documentDetail.code !== editDocumentCode) {
			// 如果还没有加载文档详情，先加载
			void knowledgeStore.fetchDocumentDetail(knowledgeCode, editDocumentCode)
			return
		}

		// 预填充数据到对应的 store
		const documentFile = documentDetail.document_file

		if (documentType === "local") {
			if (!documentFile) return
			// 本地文档：预填充上传的文件信息
			const uploadFileItem = {
				uid: `edit-${documentFile.url}`,
				name: documentFile.name,
				file: new File([], documentFile.name), // 编辑模式下不需要实际文件对象
				status: UPLOAD_STATUS.DONE,
				progress: 100,
				key: documentFile.url,
				path: documentFile.url,
				size: 0, // 编辑模式下不需要大小
			}
			store.localDocumentStore.uploadedFiles = [uploadFileItem]

			// 加载原始文档内容（用于预览）
			const loadOriginalContent = async () => {
				try {
					const originalLinkResponse = await KnowledgeApi.getDocumentOriginalFileLink({
						knowledge_code: knowledgeCode,
						document_code: editDocumentCode,
					})
					if (originalLinkResponse.url) {
						const content = await downloadFileContent(originalLinkResponse.url, {
							responseType: "text",
						})
						store.localDocumentStore.setEditModeOriginalContent(content as string)
					}
				} catch (error) {
					console.error("Failed to load original content for edit mode:", error)
				}
			}
			void loadOriginalContent()
		} else if (documentType === "custom") {
			// 自定义内容：预填充文档名称
			// 内容需要从原文接口获取，这里先不处理
			store.customContentStore.setDocumentName(documentDetail.name)
		}
		// project / wiki：无 document_file 或仅作占位，策略与分块配置在下方从详情接口回显

		// 预填充策略配置
		if (documentDetail.fragment_config) {
			const config = documentDetail.fragment_config

			// 从 strategy_config 或 documentFile 读取解析策略配置
			// 优先使用 strategy_config，否则回退到 documentFile（向后兼容）
			const apiStrategyConfig = documentDetail.strategy_config
			const parsingType = apiStrategyConfig?.parsing_type ?? documentFile?.parsing_type ?? 1 // 默认精确解析
			const parsingStrategy = parsingType === 0 ? ("quick" as const) : ("precise" as const)
			const enablePreciseParsing = parsingType === 1
			const extractImages =
				apiStrategyConfig?.image_extraction ?? documentFile?.image_extraction ?? true
			const extractOCR = apiStrategyConfig?.image_ocr ?? documentFile?.image_ocr ?? true
			const extractTables =
				apiStrategyConfig?.table_extraction ?? documentFile?.table_extraction ?? true

			// 从 fragment_config 读取预处理规则
			const apiPreprocessingRules =
				config.mode === 1 // CUSTOM
					? config.normal?.text_preprocess_rule || []
					: config.mode === 3 // HIERARCHY
						? config.hierarchy?.text_preprocess_rule || []
						: []

			// 将 API 枚举转换为 UI 字符串格式
			type PreprocessingRuleOrNull = PreprocessingRule | null
			const preprocessingRules = apiPreprocessingRules
				.map((rule): PreprocessingRuleOrNull => {
					switch (rule) {
						case 1: // TextPreprocessingRules.REPLACE_SPACES
							return PREPROCESSING_RULES.REPLACE_WHITESPACE
						case 2: // TextPreprocessingRules.REMOVE_URLS
							return PREPROCESSING_RULES.REMOVE_URLS
						default:
							return null
					}
				})
				.filter((rule): rule is PreprocessingRule => rule !== null)

			const strategyConfig = {
				parsingStrategy,
				enablePreciseParsing,
				extractImages,
				extractOCR,
				extractTables,
				chunkingStrategy: (() => {
					switch (config.mode) {
						case 1:
							return "custom" as const
						case 2:
							return "auto" as const
						case 3:
							return "hierarchical" as const
						default:
							return "auto" as const
					}
				})(),
				enableChunkingConfig: true,
				chunkSeparator: "lineBreak" as const,
				maxChunkLength: config.normal?.segment_rule?.chunk_size ?? 800,
				chunkOverlap: config.normal?.segment_rule?.chunk_overlap ?? 10,
				chunkHierarchy: config.hierarchy?.max_level ?? 3,
				preserveHierarchy: config.hierarchy?.keep_hierarchy_info ?? true,
				preprocessingRules,
			}

			if (documentType === "local") {
				store.localDocumentStore.updateStrategyConfig(
					strategyConfig as Partial<StrategyConfig>,
				)
			} else if (documentType === "custom") {
				store.customContentStore.updateStrategyConfig(
					strategyConfig as Partial<StrategyConfig>,
				)
			} else if (documentType === "project") {
				store.projectDocumentStore.updateStrategyConfig(
					strategyConfig as Partial<StrategyConfig>,
				)
			} else if (documentType === "wiki") {
				store.wikiDocumentStore.updateStrategyConfig(
					strategyConfig as Partial<StrategyConfig>,
				)
			}
		}
	}, [
		editMode,
		editDocumentCode,
		documentType,
		knowledgeCode,
		knowledgeStore,
		knowledgeStore.documentDetail,
		store,
	])

	return store
}
