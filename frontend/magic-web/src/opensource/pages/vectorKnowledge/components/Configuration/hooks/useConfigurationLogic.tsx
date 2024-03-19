import { useEffect, useState } from "react"
import { Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { TemporaryKnowledgeConfig } from "@/opensource/pages/vectorKnowledge/types"
import { useFormConfig } from "./useFormConfig"
import { KnowledgeApi } from "@/opensource/apis"
import { useDocumentData } from "./useDocumentData"
import { useSegmentPreview } from "./useSegmentPreview"
import { useEmbeddingModels } from "./useEmbeddingModels"
import {
	getFileIconByExt,
	getFileIconByFileType,
	getExternalFileIconByType,
	getDocumentKey,
} from "../../../constant"
import { isFragmentConfigChanged } from "./formUtils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

/**
 * 知识库创建/文档配置逻辑
 */
export function useConfigurationLogic(
	navigateToDocumentList: (knowledgeBaseCode: string) => void,
	knowledgeBase?: TemporaryKnowledgeConfig,
	handleConfigurationSubmit?: (data: TemporaryKnowledgeConfig) => Promise<void>,
	documentConfig?: {
		knowledgeBaseCode: string
		documentCode: string
	},
) {
	const { t } = useTranslation("flow")

	// 获取表单配置逻辑
	const {
		form,
		segmentMode,
		parentBlockType,
		handleSegmentModeChange,
		handleParentBlockTypeChange,
		handleSegmentSettingReset,
		processFormData,
		initialValues,
	} = useFormConfig()

	// 获取文档数据逻辑
	const {
		documentList,
		currentDocumentDetail,
		saveDocumentConfig,
		initDocumentData,
		isOldVersion,
	} = useDocumentData(form, documentConfig)

	// 获取分段预览逻辑
	const {
		segmentDocument,
		segmentPreviewResult,
		segmentPreviewLoading,
		handleSegmentPreview,
		handleDocumentChange,
		getFragmentList,
	} = useSegmentPreview(form, currentDocumentDetail)

	// 获取嵌入模型逻辑
	const { embeddingModelOptions } = useEmbeddingModels()

	// 分段预览文档选项
	const segmentDocumentOptions = documentList.map((item) => {
		// 目前有三种预览场景
		// 1. 预览文档是外部文件(本地上传的文件)，且未向量化，此时是创建知识库的分段预览；
		// 2. 预览文档是第三方文件，且未向量化，此时是创建知识库的分段预览；
		// 3. 预览文档是内部文件，且已向量化，此时是更新知识库文档的分段配置的预览。
		let icon = null
		if (item.is_embed && item.file_type) {
			icon = getExternalFileIconByType(item.file_type, 14)
		} else if (item.file_type) {
			icon = getFileIconByFileType(item.type, item.file_type, 14)
		} else {
			icon = getFileIconByExt(item.name.split(".").pop() || "", 14)
		}
		return {
			label: (
				<Flex align="center" gap={8}>
					{icon}
					<div>{item.name}</div>
				</Flex>
			),
			value: item[getDocumentKey(item.type)] || "",
		}
	})

	// 保存配置
	const [isSaving, setIsSaving] = useState(false)
	const handleSaveConfiguration = useMemoizedFn(async () => {
		try {
			if (isSaving) return
			const processedFormData = await processFormData()
			if (!processedFormData) return
			setIsSaving(true)

			// 业务场景一：创建知识库
			if (knowledgeBase) {
				const submitData = {
					...knowledgeBase,
					...processedFormData,
				}
				// 保存知识库配置
				await handleConfigurationSubmit?.(submitData)
			} else if (currentDocumentDetail) {
				// 业务场景二：更新知识库文档的分段设置
				// 检查fragment_config分段设置是否发生变化，如果未发生变化，则不进行保存请求和重新向量化
				const hasChanged = isFragmentConfigChanged(
					currentDocumentDetail.fragment_config,
					processedFormData.fragment_config,
				)
				if (hasChanged) {
					// 保存知识库文档配置
					await saveDocumentConfig(
						currentDocumentDetail,
						processedFormData.fragment_config,
					)
					// 重新向量化文档
					await KnowledgeApi.revectorizeDocument({
						knowledgeBaseCode: currentDocumentDetail.knowledge_base_code,
						documentCode: currentDocumentDetail.code,
					})
				}
				setIsSaving(false)
				// 跳转文档列表
				navigateToDocumentList(currentDocumentDetail.knowledge_base_code)
			}
		} catch (error) {
			console.error("保存配置失败:", error)
			magicToast.error(t("knowledgeDatabase.saveConfigFailed"))
		} finally {
			setIsSaving(false)
		}
	})

	// 处理分段预览按钮点击
	const handleSegmentPreviewClick = useMemoizedFn(() => {
		handleSegmentPreview(documentList)()
	})

	// 初始化数据
	useEffect(() => {
		initDocumentData(knowledgeBase)
	}, [])

	return {
		form,
		currentDocumentDetail,
		isOldVersion,
		segmentMode,
		parentBlockType,
		embeddingModelOptions,
		segmentDocument,
		setSegmentDocument: handleDocumentChange(documentList),
		segmentDocumentOptions,
		segmentPreviewResult,
		segmentPreviewLoading,
		getFragmentList,
		handleSaveConfiguration,
		handleSegmentModeChange,
		handleParentBlockTypeChange,
		handleSegmentSettingReset,
		handleSegmentPreviewClick,
		initialValues,
		isSaving,
	}
}
