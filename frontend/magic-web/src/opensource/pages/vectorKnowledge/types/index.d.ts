import {
	SegmentationMode,
	TextPreprocessingRules,
	ParentBlockMode,
	RetrievalMethod,
	DataSourceType,
} from "../constant"
import type { Knowledge } from "@/opensource/types/knowledge"

export interface FileData {
	id: string
	name: string
	file: File
	status: "init" | "uploading" | "done" | "error"
	progress: number
	result?: {
		key: string
		name: string
		size: number
	}
	error?: Error
	cancel?: () => void
}

/** 临时创建的知识库 */
export interface TemporaryKnowledgeConfig {
	name: string
	icon: string
	description: string
	enabled: boolean
	document_files: Knowledge.PreviewDocumentDetail[]
	fragmentConfig?: FragmentConfig
	embeddingConfig?: EmbeddingModelConfig
	retrieveConfig?: RetrieveConfig
	source_type: DataSourceType
}

/** 分段配置 */
export interface FragmentConfig {
	mode: SegmentationMode
	normal: {
		text_preprocess_rule: TextPreprocessingRules[]
		segment_rule: {
			separator: string
			chunk_size: number
			chunk_overlap: number
		}
	}
	parent_child: {
		parent_mode: ParentBlockMode
		separator: string
		chunk_size: number
		parent_segment_rule: {
			separator: string
			chunk_size: number
		}
		child_segment_rule: {
			separator: string
			chunk_size: number
		}
		text_preprocess_rule: TextPreprocessingRules[]
	}
}

/** 嵌入模型配置 */
export interface EmbeddingModelConfig {
	model_id: string | undefined
}

/** 检索配置 */
export interface RetrieveConfig {
	search_method: RetrievalMethod
	top_k: number
	score_threshold: number
	score_threshold_enabled: boolean
	reranking_model: {
		model_id: string | undefined
		reranking_model_name: string
		reranking_provider_name: string
	}
	reranking_enable: boolean
}

/** 配置表单数据类型 */
export interface ConfigFormValues {
	fragment_config: Omit<FragmentConfig, "normal" | "parent_child"> & {
		normal: Omit<FragmentConfig["normal"], "text_preprocess_rule"> & {
			// 使用布尔值替代text_preprocess_rule数组
			replace_spaces: boolean
			remove_urls: boolean
		}
		parent_child: Omit<FragmentConfig["parent_child"], "text_preprocess_rule"> & {
			// 使用布尔值替代text_preprocess_rule数组
			replace_spaces: boolean
			remove_urls: boolean
		}
	}
	embedding_config: EmbeddingModelConfig
	retrieve_config: RetrieveConfig
}

/** 分段预览结果类型 */
export interface SegmentPreviewType {
	total: number
	list: Knowledge.FragmentItem[]
	page: number
}
