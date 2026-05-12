import { KnowledgeApi } from "@/apis"
import { CrewKnowledge } from "@/types/crew-knowledge"
import { DOCUMENT_TYPE } from "../constants/document-constants"

/**
 * 创建本地文档参数
 */
export interface CreateLocalDocumentParams {
	knowledgeCode: string
	fileName: string
	fileKey: string
	fragmentConfig?: CrewKnowledge.FragmentConfig
	parsingConfig?: {
		parsingType: number // 0-快速解析, 1-精确解析
		imageExtraction: boolean
		tableExtraction: boolean
		imageOcr: boolean
	}
}

/**
 * 创建自定义内容文档参数
 */
export interface CreateCustomDocumentParams {
	knowledgeCode: string
	name: string
	fileKey: string
	fragmentConfig?: CrewKnowledge.FragmentConfig
	parsingConfig?: {
		parsingType: number // 0-快速解析, 1-精确解析
		imageExtraction: boolean
		tableExtraction: boolean
		imageOcr: boolean
	}
}

/**
 * 创建本地文档
 */
export async function createLocalDocument(
	params: CreateLocalDocumentParams,
): Promise<CrewKnowledge.EmbedDocumentDetail> {
	const { knowledgeCode, fileName, fileKey, fragmentConfig, parsingConfig } = params

	// 默认解析配置（如果没有传入）
	const defaultParsingConfig = {
		parsingType: 1, // 默认精确解析
		imageExtraction: true,
		tableExtraction: true,
		imageOcr: true,
	}

	const finalParsingConfig = parsingConfig || defaultParsingConfig

	try {
		const result = await KnowledgeApi.addCrewKnowledgeDocument({
			knowledge_code: knowledgeCode,
			name: fileName,
			enabled: true,
			doc_type: DOCUMENT_TYPE.LOCAL_DOCUMENT,
			strategy_config: {
				parsing_type: finalParsingConfig.parsingType,
				image_extraction: finalParsingConfig.imageExtraction,
				table_extraction: finalParsingConfig.tableExtraction,
				image_ocr: finalParsingConfig.imageOcr,
			},
			fragment_config: fragmentConfig,
			document_file: {
				name: fileName,
				key: fileKey,
				type: CrewKnowledge.DocumentFileType.NORMAL_FILE,
			},
		})

		return result
	} catch (error) {
		console.error("Create local document failed:", error)
		throw error
	}
}

/**
 * 创建自定义内容文档
 * 注意：fileKey 应该由调用方通过 useUpload hook 上传后获得
 */
export async function createCustomDocument(
	params: CreateCustomDocumentParams,
): Promise<CrewKnowledge.EmbedDocumentDetail> {
	const { knowledgeCode, name, fileKey, fragmentConfig, parsingConfig } = params

	// 默认解析配置（如果没有传入）
	const defaultParsingConfig = {
		parsingType: 1, // 默认精确解析
		imageExtraction: true,
		tableExtraction: true,
		imageOcr: true,
	}

	const finalParsingConfig = parsingConfig || defaultParsingConfig

	try {
		// 创建文档
		const result = await KnowledgeApi.addCrewKnowledgeDocument({
			knowledge_code: knowledgeCode,
			name: name,
			enabled: true,
			doc_type: DOCUMENT_TYPE.CUSTOM_CONTENT,
			strategy_config: {
				parsing_type: finalParsingConfig.parsingType,
				image_extraction: finalParsingConfig.imageExtraction,
				table_extraction: finalParsingConfig.tableExtraction,
				image_ocr: finalParsingConfig.imageOcr,
			},
			fragment_config: fragmentConfig,
			document_file: {
				name: `${name}.md`,
				key: fileKey,
				type: CrewKnowledge.DocumentFileType.NORMAL_FILE,
			},
		})

		return result
	} catch (error) {
		console.error("Create custom document failed:", error)
		throw error
	}
}

/**
 * 批量创建本地文档
 */
export async function createLocalDocumentsBatch(
	knowledgeCode: string,
	files: Array<{ fileId: string; fileName: string; fileKey: string }>,
	fragmentConfig?: CrewKnowledge.FragmentConfig,
	parsingConfig?: {
		parsingType: number
		imageExtraction: boolean
		tableExtraction: boolean
		imageOcr: boolean
	},
): Promise<{
	succeeded: Array<{ fileId: string; document: CrewKnowledge.EmbedDocumentDetail }>
	failed: Array<{ fileId: string; fileName: string; error: unknown }>
}> {
	const results = await Promise.allSettled(
		files.map((file) =>
			createLocalDocument({
				knowledgeCode,
				fileName: file.fileName,
				fileKey: file.fileKey,
				fragmentConfig,
				parsingConfig,
			}),
		),
	)

	const succeeded: Array<{ fileId: string; document: CrewKnowledge.EmbedDocumentDetail }> = []
	const failed: Array<{ fileId: string; fileName: string; error: unknown }> = []

	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			succeeded.push({
				fileId: files[index].fileId,
				document: result.value,
			})
		} else {
			failed.push({
				fileId: files[index].fileId,
				fileName: files[index].fileName,
				error: result.reason,
			})
		}
	})

	return { succeeded, failed }
}
