import { useEffect, useState } from "react"
import { FormInstance } from "antd"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { KnowledgeApi } from "@/apis"
import { TextPreprocessingRules, SegmentationMode, getDocumentKey } from "../../../constant"
import type { ConfigFormValues, SegmentPreviewType, FragmentConfig } from "../../../types"
import { Knowledge } from "@/types/knowledge"
import magicToast from "@/components/base/MagicToaster/utils"

export function useSegmentPreview(
	form: FormInstance<ConfigFormValues>,
	currentDocumentDetail?: Knowledge.EmbedDocumentDetail,
) {
	const { t } = useTranslation("flow")

	// 分段预览相关状态
	const [segmentDocument, setSegmentDocument] = useState<string>()
	const [segmentPreviewResult, setSegmentPreviewResult] = useState<SegmentPreviewType>({
		total: 0,
		list: [],
		page: 1,
	})
	const [segmentPreviewLoading, setSegmentPreviewLoading] = useState(false)

	// 获取分段预览
	const fetchSegmentPreview = useMemoizedFn(async (document: Knowledge.CreateKnowledgeFile) => {
		const { fragment_config } = await form.validateFields(["fragment_config"], {
			recursive: true,
		})
		// 重置分段预览结果
		setSegmentPreviewResult({
			total: 0,
			list: [],
			page: 1,
		})
		setSegmentPreviewLoading(true)
		try {
			// 转换布尔值为数组
			const apiFragmentConfig = {
				...fragment_config,
				normal:
					fragment_config.mode === SegmentationMode.General
						? {
							...fragment_config.normal,
							text_preprocess_rule: [
								...(fragment_config.normal.replace_spaces
									? [TextPreprocessingRules.ReplaceSpaces]
									: []),
								...(fragment_config.normal.remove_urls
									? [TextPreprocessingRules.RemoveUrls]
									: []),
							],
							// 移除boolean属性
							replace_spaces: undefined,
							remove_urls: undefined,
						}
						: undefined,
				parent_child:
					fragment_config.mode === SegmentationMode.ParentChild
						? {
							...fragment_config.parent_child,
							text_preprocess_rule: [
								...(fragment_config.parent_child.replace_spaces
									? [TextPreprocessingRules.ReplaceSpaces]
									: []),
								...(fragment_config.parent_child.remove_urls
									? [TextPreprocessingRules.RemoveUrls]
									: []),
							],
							// 移除boolean属性
							replace_spaces: undefined,
							remove_urls: undefined,
						}
						: undefined,
			}

			const res = await KnowledgeApi.segmentPreview({
				fragment_config: apiFragmentConfig as FragmentConfig,
				document_file: document,
			})
			if (res) {
				setSegmentPreviewResult({
					total: res.total,
					list: res.list,
					page: 1,
				})
			}
			setSegmentPreviewLoading(false)
		} catch (error) {
			magicToast.error(t("knowledgeDatabase.segmentPreviewFailed"))
			setSegmentPreviewLoading(false)
		}
	})

	// 点击分段预览按钮
	const handleSegmentPreview = useMemoizedFn(
		(documentList: Knowledge.CreateKnowledgeFile[]) => async () => {
			let targetKey: "key" | "third_file_id" = "key"
			if (segmentDocument) {
				targetKey = getDocumentKey(
					documentList.find((item) =>
						[item.key, item.third_file_id].includes(segmentDocument),
					)?.type,
				)
			} else if (!segmentDocument && documentList.length > 0) {
				targetKey = getDocumentKey(documentList[0].type) || targetKey
				setSegmentDocument(documentList[0][targetKey])
			}

			if (documentList.length > 0) {
				fetchSegmentPreview({
					name: segmentDocument
						? (documentList.find((item) => item[targetKey] === segmentDocument)?.name ??
							"")
						: documentList[0].name,
					key: segmentDocument
						? (documentList.find((item) => item[targetKey] === segmentDocument)?.key ??
							"")
						: documentList[0].key,
					type: documentList[0].type,
					platform_type: segmentDocument
						? (documentList.find((item) => item[targetKey] === segmentDocument)
							?.platform_type ?? "")
						: documentList[0].platform_type,
					third_file_id: segmentDocument
						? (documentList.find((item) => item[targetKey] === segmentDocument)
							?.third_file_id ?? "")
						: documentList[0].third_file_id,
				})
			}
		},
	)

	// 当选择的文档变更时触发预览
	const handleDocumentChange = useMemoizedFn(
		(documentList: Knowledge.PreviewDocumentDetail[]) => {
			return (docKey: string) => {
				setSegmentDocument(docKey)
				if (docKey) {
					const doc = documentList.find(
						(item) => item[getDocumentKey(item.type)] === docKey,
					)
					if (doc) {
						fetchSegmentPreview(doc)
					}
				}
			}
		},
	)

	// 查看已向量化的文档的分段列表
	const fetchFragmentList = useMemoizedFn(
		async ({
			knowledgeBaseCode,
			documentCode,
			page,
			pageSize,
		}: {
			knowledgeBaseCode: string
			documentCode: string
			page: number
			pageSize: number
		}) => {
			try {
				if (segmentPreviewLoading) return
				setSegmentPreviewLoading(true)
				const res = await KnowledgeApi.getFragmentList({
					knowledgeBaseCode,
					documentCode,
					page,
					pageSize,
				})
				// 分页处理
				if (res && res.page === 1) {
					setSegmentPreviewResult({
						total: res.total,
						list: res.list,
						page: 1,
					})
				} else if (res && res.page - 1 === segmentPreviewResult.page) {
					const newList = [...segmentPreviewResult.list, ...res.list]
					setSegmentPreviewResult({
						total: res.total,
						list: newList,
						page: res.page,
					})
				}
				setSegmentPreviewLoading(false)
			} catch (error) {
				magicToast.error(t("knowledgeDatabase.getFragmentListFailed"))
				setSegmentPreviewLoading(false)
			}
		},
	)

	useEffect(() => {
		// 对于单个文档的配置场景，直接将该文档设置为预览文档
		if (currentDocumentDetail) {
			setSegmentDocument(
				currentDocumentDetail.document_file?.type ===
					Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE
					? currentDocumentDetail.document_file.key
					: currentDocumentDetail.document_file?.third_file_id,
			)
		}
	}, [currentDocumentDetail])

	return {
		segmentDocument,
		segmentPreviewResult,
		segmentPreviewLoading,
		handleSegmentPreview,
		handleDocumentChange,
		setSegmentDocument,
		getFragmentList: fetchFragmentList,
	}
}
