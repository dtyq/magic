import { useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { KnowledgeApi } from "@/apis"
import { Knowledge } from "@/types/knowledge"
import { TextPreprocessingRules, externalFileTypeMap } from "../../../constant"
import type { FormInstance } from "antd"
import type { ConfigFormValues, FragmentConfig, TemporaryKnowledgeConfig } from "../../../types"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"

export function useDocumentData(
	form: FormInstance<ConfigFormValues>,
	documentConfig?: {
		knowledgeBaseCode: string
		documentCode: string
	},
) {
	const { t } = useTranslation("flow")

	// 当前配置的文档详情
	const [currentDocumentDetail, setCurrentDocumentDetail] =
		useState<Knowledge.EmbedDocumentDetail>()

	// 供分段预览的文档列表
	const [documentList, setDocumentList] = useState<Knowledge.PreviewDocumentDetail[]>([])

	// 基于文档编码获取文档信息
	const fetchDocumentDetails = useMemoizedFn(
		async (knowledgeBaseCode: string, documentCode: string) => {
			try {
				const res = await KnowledgeApi.getKnowledgeDocumentDetail({
					knowledge_code: knowledgeBaseCode,
					document_code: documentCode,
				})
				if (res) {
					setDocumentList([
						{
							id: res.id || "",
							name: res.name,
							key: res.document_file?.key || "",
							type:
								res.document_file?.type ||
								Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE,
							platform_type: res.document_file?.platform_type || "",
							third_file_id: res.document_file?.third_file_id || "",
							file_type: res.doc_type,
							space_type: Knowledge.SpaceType.ANY,
							is_embed: true,
						},
					])
					setCurrentDocumentDetail(res)
					form.setFieldValue("fragment_config", res.fragment_config)
					if (res.fragment_config.normal) {
						form.setFieldValue(
							["fragment_config", "normal", "replace_spaces"],
							res.fragment_config.normal.text_preprocess_rule.includes(
								TextPreprocessingRules.ReplaceSpaces,
							),
						)
						form.setFieldValue(
							["fragment_config", "normal", "remove_urls"],
							res.fragment_config.normal.text_preprocess_rule.includes(
								TextPreprocessingRules.RemoveUrls,
							),
						)
					}
					if (res.fragment_config.parent_child) {
						form.setFieldValue(
							["fragment_config", "parent_child", "replace_spaces"],
							res.fragment_config.parent_child.text_preprocess_rule.includes(
								TextPreprocessingRules.ReplaceSpaces,
							),
						)
						form.setFieldValue(
							["fragment_config", "parent_child", "remove_urls"],
							res.fragment_config.parent_child.text_preprocess_rule.includes(
								TextPreprocessingRules.RemoveUrls,
							),
						)
					}
					form.setFieldValue("embedding_config", res.embedding_config)
					form.setFieldValue("retrieve_config", res.retrieve_config)
				}
			} catch (error) {
				console.error("获取文档信息失败:", error)
			}
		},
	)

	// 保存文档配置
	const updateDocumentConfig = useMemoizedFn(
		async (documentConfig: Knowledge.EmbedDocumentDetail, fragmentConfig: FragmentConfig) => {
			try {
				const res = await KnowledgeApi.updateKnowledgeDocument({
					knowledge_code: documentConfig.knowledge_base_code,
					document_code: documentConfig.code,
					name: documentConfig.name,
					enabled: documentConfig.enabled,
					fragment_config: fragmentConfig,
				})
				if (res) {
					magicToast.success(t("knowledgeDatabase.savedSuccess"))
				}
			} catch (error) {
				console.error("保存文档配置失败:", error)
			}
		},
	)

	// 由于目前目录无法被分段，需将选择的天书目录转化为其子文件
	const convertTeamshareDirectoryToFile = useMemoizedFn(
		async (directory: Knowledge.PreviewDocumentDetail) => {
			try {
				const res = await KnowledgeApi.getTeamshareFileCascadeChildren({
					space_type: directory.space_type,
					parent_id: directory.id,
					page_size: 5,
				})
				if (res) {
					return res.map((item: Knowledge.TeamshareFileCascadeChildrenItem) => ({
						id: item.id,
						name: item.name,
						key: "",
						type: Knowledge.CreateKnowledgeFileType.THIRD_PLATFORM_FILE,
						file_type: item.file_type || externalFileTypeMap.UNKNOWN,
						platform_type: Knowledge.FilePlatformType.TEAMSHARE,
						third_file_id: item.id || "",
						space_type: item.space_type,
						is_embed: false,
					}))
				}
				return []
			} catch (error) {
				console.error("获取天书目录子文件失败:", error)
				return []
			}
		},
	)

	// 初始化文档数据
	const initDocumentData = useMemoizedFn(async (knowledgeBase?: TemporaryKnowledgeConfig) => {
		if (documentConfig) {
			fetchDocumentDetails(documentConfig.knowledgeBaseCode, documentConfig.documentCode)
		} else if (knowledgeBase) {
			// 拆分 文件 和 文件夹/知识库
			const folderItems = knowledgeBase.document_files.filter(
				(item) =>
					item.type === Knowledge.CreateKnowledgeFileType.THIRD_PLATFORM_FILE &&
					[
						Knowledge.TeamshareFileCascadeItemFileType.FOLDER,
						Knowledge.TeamshareFileCascadeItemFileType.KNOWLEDGE_BASE,
					].includes(item.file_type),
			)
			const fileItems = knowledgeBase.document_files.filter(
				(item) =>
					item.type === Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE ||
					![
						Knowledge.TeamshareFileCascadeItemFileType.FOLDER,
						Knowledge.TeamshareFileCascadeItemFileType.KNOWLEDGE_BASE,
					].includes(item.file_type),
			)

			// 处理非文件夹项目
			const fileDocuments = fileItems.map((item) => ({
				id: item.id,
				name: item.name,
				key: item.key || "",
				type: item.type,
				file_type: item.file_type || externalFileTypeMap.UNKNOWN,
				platform_type: item.platform_type || "",
				third_file_id: item.third_file_id || "",
				space_type: item.space_type,
				is_embed: false,
			}))

			// 处理文件夹项目，等待所有请求完成
			const folderPromises = folderItems.map((item) => convertTeamshareDirectoryToFile(item))
			const folderResults = await Promise.all(folderPromises)

			// 将所有子文件合并为一个数组
			const folderDocuments = folderResults.flat()

			// 合并文件和文件夹子文件，一次性设置
			setDocumentList([...fileDocuments, ...folderDocuments])
		}
	})

	// 由于后端在旧版本的知识库未对文档信息进行持久化，故需要做旧版本的兼容处理：
	// 根据文档的 document_file 字段是否为null，来判断是否为旧版本知识库的文档
	// 旧版本的文档不支持重新编辑分段设置，只能基于原先的分段设置查看分段列表
	// （注：查看分段列表的接口 与创建知识库时的 分段预览接口 不是同一个）
	const isOldVersion = useMemo(() => {
		return Boolean(currentDocumentDetail && !currentDocumentDetail.document_file)
	}, [currentDocumentDetail])

	return {
		documentList,
		setDocumentList,
		currentDocumentDetail,
		isOldVersion,
		getDocumentDetails: fetchDocumentDetails,
		saveDocumentConfig: updateDocumentConfig,
		initDocumentData,
	}
}
