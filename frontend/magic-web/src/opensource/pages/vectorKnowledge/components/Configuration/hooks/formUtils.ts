import {
	TextPreprocessingRules,
	SegmentationMode,
	ParentBlockMode,
	RetrievalMethod,
} from "../../../constant"
import type { FragmentConfig, ConfigFormValues } from "@/opensource/pages/vectorKnowledge/types"
import { isEqual, cloneDeep } from "lodash-es"

/** 初始化表单数据 */
export const DEFAULT_FORM_VALUES: ConfigFormValues = {
	fragment_config: {
		mode: SegmentationMode.General,
		normal: {
			replace_spaces: true,
			remove_urls: false,
			segment_rule: {
				separator: "\\n\\n",
				chunk_size: 500,
				chunk_overlap: 50,
			},
		},
		parent_child: {
			parent_mode: ParentBlockMode.Paragraph,
			separator: "\\n\\n",
			chunk_size: 500,
			parent_segment_rule: {
				separator: "\\n\\n",
				chunk_size: 500,
			},
			child_segment_rule: {
				separator: "\\n\\n",
				chunk_size: 500,
			},
			replace_spaces: true,
			remove_urls: false,
		},
	},
	embedding_config: {
		model_id: undefined,
	},
	retrieve_config: {
		search_method: RetrievalMethod.SemanticSearch,
		top_k: 3,
		score_threshold: 0.5,
		score_threshold_enabled: false,
		reranking_model: {
			model_id: undefined,
			reranking_model_name: "",
			reranking_provider_name: "",
		},
		reranking_enable: false,
	},
}

/** 将表单布尔值转换为API所需的数组格式 */
export function convertBooleanToPreprocessingRules(
	replaceSpaces: boolean,
	removeUrls: boolean,
): TextPreprocessingRules[] {
	const rules: TextPreprocessingRules[] = []

	if (replaceSpaces) {
		rules.push(TextPreprocessingRules.ReplaceSpaces)
	}

	if (removeUrls) {
		rules.push(TextPreprocessingRules.RemoveUrls)
	}

	return rules
}

/**
 * 比较新旧fragment_config配置是否有变化
 * @param oldConfig 旧的fragment_config配置
 * @param newConfig 新的fragment_config配置
 * @returns 是否发生变化
 */
export function isFragmentConfigChanged(
	oldConfig: FragmentConfig,
	newConfig: FragmentConfig,
): boolean {
	if (!oldConfig || !newConfig) {
		return true // 如果任一配置为空，默认认为有变化
	}

	// 检查mode是否相同
	if (oldConfig.mode !== newConfig.mode) {
		return true
	}

	// 根据mode决定比较哪部分配置
	if (newConfig.mode === SegmentationMode.General) {
		// 普通模式下比较normal部分
		if (!oldConfig.normal || !newConfig.normal) {
			return true
		}

		// 深拷贝以避免修改原始对象
		const oldNormal = cloneDeep(oldConfig.normal)
		const newNormal = cloneDeep(newConfig.normal)

		// 对text_preprocess_rule排序以忽略顺序差异
		if (oldNormal.text_preprocess_rule && newNormal.text_preprocess_rule) {
			oldNormal.text_preprocess_rule.sort()
			newNormal.text_preprocess_rule.sort()
		}

		return !isEqual(oldNormal, newNormal)
	} else if (newConfig.mode === SegmentationMode.ParentChild) {
		// 父子模式下比较parent_child部分
		if (!oldConfig.parent_child || !newConfig.parent_child) {
			return true
		}

		// 深拷贝以避免修改原始对象
		const oldParentChild = cloneDeep(oldConfig.parent_child)
		const newParentChild = cloneDeep(newConfig.parent_child)

		// 对text_preprocess_rule排序以忽略顺序差异
		if (oldParentChild.text_preprocess_rule && newParentChild.text_preprocess_rule) {
			oldParentChild.text_preprocess_rule.sort()
			newParentChild.text_preprocess_rule.sort()
		}

		return !isEqual(oldParentChild, newParentChild)
	}

	// 默认认为有变化
	return true
}
