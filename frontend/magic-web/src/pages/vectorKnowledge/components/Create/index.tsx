import { useState, useMemo, useEffect } from "react"
import { Form, Input, Button, Flex } from "antd"
import { IconChevronLeft } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import DEFAULT_KNOWLEDGE_ICON from "@/assets/logos/knowledge-avatar.png"
import { useTranslation } from "react-i18next"
import useNavigate from "@/routes/hooks/useNavigate"
import { useSearchParams } from "react-router-dom"
import { FlowRouteType } from "@/types/flow"
import MagicIcon from "@/components/base/MagicIcon"
import { useVectorKnowledgeCreateStyles } from "./styles"
import VectorKnowledgeEmbed from "../Embed"
import { KnowledgeApi } from "@/apis"
import ImageUpload from "../Upload/ImageUpload"
import VectorKnowledgeConfiguration from "../Configuration"
import type { TemporaryKnowledgeConfig } from "../../types"
import LocalFile from "./components/LocalFile"
import EnterpriseKnowledge from "./components/EnterpriseKnowledge"
import IconLocalFile from "@/enhance/tabler/icons-react/icons/IconLocalFile"
import IconEnterpriseKnowledge from "@/enhance/tabler/icons-react/icons/IconEnterpriseKnowledge"
import { DataSourceType, externalFileTypeMap } from "../../constant"
import { Knowledge } from "@/types/knowledge"
import { RouteName } from "@/routes/constants"
import magicToast from "@/components/base/MagicToaster/utils"

type FormDataType = {
	name: string
	description: string
}

type LocalUploadFileStatus = "done" | "error" | "uploading"

export interface LocalUploadFileItem {
	uid: string
	name: string
	type: Knowledge.CreateKnowledgeFileType
	file: File
	status: LocalUploadFileStatus
	path?: string
}

export default function VectorKnowledgeCreate() {
	const { styles } = useVectorKnowledgeCreateStyles()

	const { t } = useTranslation("flow")

	const navigate = useNavigate()

	// 获取路由参数，用于跳转文档配置页面
	const [searchParams] = useSearchParams()
	const queryKnowledgeBaseCode = searchParams.get("knowledgeBaseCode") || ""
	const queryDocumentCode = searchParams.get("documentCode") || ""
	// 是否处于文档配置状态
	const [isDocumentConfig, setIsDocumentConfig] = useState(false)

	const [form] = Form.useForm<FormDataType>()

	// 数据源类型
	const [dataSourceType, setDataSourceType] = useState<DataSourceType>(DataSourceType.Local)

	// 预览图标URL
	const [previewIconUrl, setPreviewIconUrl] = useState(DEFAULT_KNOWLEDGE_ICON)
	// 上传图标URL
	const [uploadIconUrl, setUploadIconUrl] = useState("")
	// 本地上传文件列表
	const [localFileList, setLocalFileList] = useState<LocalUploadFileItem[]>([])
	// 企业知识库文件列表
	const [enterpriseFileList, setEnterpriseFileList] = useState<
		Knowledge.TeamshareFileCascadeItem[]
	>([])

	// 是否允许提交
	const [allowSubmit, setAllowSubmit] = useState(false)
	// 临时缓存的知识库配置
	const [temporaryConfig, setTemporaryConfig] = useState<TemporaryKnowledgeConfig>()
	// 创建成功的知识库编码
	const [createdKnowledgeCode, setCreatedKnowledgeCode] = useState("")

	// 是否处于待配置状态
	const [isPendingConfiguration, setIsPendingConfiguration] = useState(false)

	/** 初始化表单值 */
	const initialValues = useMemo(() => {
		return {
			name: "",
			description: "",
		}
	}, [])

	/** 上一步 - 返回上一页 */
	const handleBack = useMemoizedFn(() => {
		// 如果处于文档配置状态，则返回至文档列表页面
		if (isDocumentConfig) {
			navigate({
				name: RouteName.VectorKnowledgeDetail,
				query: { code: queryKnowledgeBaseCode },
			})
		} else {
			navigate({
				name: RouteName.Flows,
				params: { type: FlowRouteType.VectorKnowledge },
			})
		}
	})

	/** 下一步 - 提交表单 */
	const handleSubmit = async () => {
		try {
			const values = await form.validateFields()
			const documentFiles =
				dataSourceType === DataSourceType.Local
					? localFileList
						.filter((item) => !!item.path)
						.map((item) => ({
							id: "",
							name: item.name,
							key: item.path!,
							type: Knowledge.CreateKnowledgeFileType.EXTERNAL_FILE,
							third_file_id: "",
							file_type: externalFileTypeMap.UNKNOWN,
							is_embed: false,
						}))
					: enterpriseFileList.map((item) => ({
						id: item.id,
						name: item.name,
						type: Knowledge.CreateKnowledgeFileType.THIRD_PLATFORM_FILE,
						platform_type: Knowledge.FilePlatformType.TEAMSHARE,
						third_file_id: item.id,
						file_type: item.file_type,
						space_type: item.space_type,
						is_embed: false,
					}))
			setTemporaryConfig({
				name: values.name,
				icon: uploadIconUrl,
				description: values.description,
				enabled: true,
				document_files: documentFiles,
				source_type: dataSourceType,
			})
			setIsPendingConfiguration(true)
		} catch (error) {
			console.error("表单验证失败:", error)
		}
	}

	/** 必填项检验 */
	const nameValue = Form.useWatch("name", form)

	/** 配置页返回 */
	const handleConfigurationBack = useMemoizedFn(() => {
		// 如果处于文档配置状态，则返回至文档列表页面
		if (isDocumentConfig) {
			navigate({
				name: RouteName.VectorKnowledgeDetail,
				query: { code: queryKnowledgeBaseCode },
			})
		} else {
			setIsPendingConfiguration(false)
		}
	})

	// 包装防抖函数以确保类型兼容性
	const handleConfigurationSubmit = useMemoizedFn(async (data: TemporaryKnowledgeConfig) => {
		try {
			// 调用接口创建知识库
			const res = await KnowledgeApi.createKnowledge(data)
			if (res) {
				// 清空表单
				form.resetFields()
				setUploadIconUrl("")
				setLocalFileList([])
				setEnterpriseFileList([])
				setIsPendingConfiguration(false)
				setCreatedKnowledgeCode(res.code)
				magicToast.success(t("common.savedSuccess"))
			}
		} catch (error) {
			console.error("创建知识库失败:", error)
			magicToast.error(t("knowledgeDatabase.saveConfigFailed"))
		}
	})

	// 判断是否允许提交
	useEffect(() => {
		// 选择本地文件时，本地文件列表不为空
		const localFileAvailable =
			dataSourceType === DataSourceType.Local && localFileList.length > 0
		// 选择企业知识库时，企业知识库文件列表不为空
		const enterpriseFileAvailable =
			dataSourceType === DataSourceType.Enterprise && enterpriseFileList.length > 0
		// 允许提交的条件：名称不为空，且选择的数据源有对应文件
		setAllowSubmit(!!nameValue && (localFileAvailable || enterpriseFileAvailable))
	}, [nameValue, localFileList, enterpriseFileList, dataSourceType])

	// 初始化时，通过路由参数，判断是否处于文档配置状态
	useEffect(() => {
		setIsDocumentConfig(!!queryKnowledgeBaseCode && !!queryDocumentCode)
	}, [])

	const PageContent = useMemo(() => {
		// 渲染配置页的条件：
		// 1. 存在知识库临时配置且处于待配置状态
		// 2. 存在文档配置，说明处于文档配置状态
		if ((temporaryConfig && isPendingConfiguration) || isDocumentConfig) {
			const documentConfig = isDocumentConfig
				? {
					knowledgeBaseCode: queryKnowledgeBaseCode,
					documentCode: queryDocumentCode,
				}
				: undefined
			return (
				<VectorKnowledgeConfiguration
					documentConfig={documentConfig}
					knowledgeBase={temporaryConfig}
					handleConfigurationSubmit={handleConfigurationSubmit}
					onBack={handleConfigurationBack}
				/>
			)
		}

		// 根据是否创建成功，判断是否要跳转至嵌入页
		if (createdKnowledgeCode) {
			return <VectorKnowledgeEmbed knowledgeBaseCode={createdKnowledgeCode} />
		}

		return (
			<Flex vertical justify="space-between" className={styles.container}>
				<div className={styles.content}>
					<div className={styles.title}>
						{t("knowledgeDatabase.createVectorKnowledge")}
					</div>
					<Form
						form={form}
						layout="vertical"
						requiredMark={false}
						initialValues={initialValues}
					>
						<Form.Item
							label={
								<div className={styles.label}>{t("knowledgeDatabase.icon")}</div>
							}
							rules={[
								{
									required: true,
									message: t("knowledgeDatabase.iconPlaceholder"),
								},
							]}
						>
							<ImageUpload
								previewIconUrl={previewIconUrl}
								setPreviewIconUrl={setPreviewIconUrl}
								setUploadIconUrl={setUploadIconUrl}
							/>
						</Form.Item>

						<Form.Item
							label={
								<div className={cx(styles.label, styles.required)}>
									{t("knowledgeDatabase.knowledgeName")}
								</div>
							}
							name="name"
							rules={[
								{
									required: true,
									message: t("knowledgeDatabase.namePlaceholder"),
								},
							]}
						>
							<Input placeholder={t("knowledgeDatabase.namePlaceholder")} />
						</Form.Item>

						<Form.Item
							label={
								<div className={styles.label}>
									{t("knowledgeDatabase.description")}
								</div>
							}
							name="description"
						>
							<Input.TextArea
								rows={4}
								placeholder={t("knowledgeDatabase.descriptionPlaceholder")}
							/>
						</Form.Item>

						<Form.Item
							label={
								<div className={styles.label}>
									{t("knowledgeDatabase.selectDataSource")}
								</div>
							}
						>
							<div className={styles.dataSourceWrapper}>
								<div
									className={cx(
										styles.dataSourceItem,
										dataSourceType === DataSourceType.Local &&
										styles.dataSourceItemActive,
									)}
									onClick={() => setDataSourceType(DataSourceType.Local)}
								>
									<div
										className={cx(styles.dataSourceItemIcon, styles.orangeIcon)}
									>
										<IconLocalFile />
									</div>
									<div>{t("knowledgeDatabase.importLocalFile")}</div>
								</div>
								<div
									className={cx(
										styles.dataSourceItem,
										dataSourceType === DataSourceType.Enterprise &&
										styles.dataSourceItemActive,
									)}
									onClick={() => setDataSourceType(DataSourceType.Enterprise)}
								>
									<div className={cx(styles.dataSourceItemIcon, styles.blueIcon)}>
										<IconEnterpriseKnowledge />
									</div>
									<div>{t("knowledgeDatabase.bindEnterpriseKnowledge")}</div>
								</div>
							</div>
						</Form.Item>
						{/* 导入本地文件 */}
						{dataSourceType === DataSourceType.Local && (
							<LocalFile fileList={localFileList} setFileList={setLocalFileList} />
						)}
						{/* 绑定企业知识库 */}
						{dataSourceType === DataSourceType.Enterprise && (
							<EnterpriseKnowledge
								selectedFiles={enterpriseFileList}
								setSelectedFiles={setEnterpriseFileList}
							/>
						)}
					</Form>
				</div>
				<Flex justify="flex-end" align="center" className={styles.footer} gap={16}>
					<Button className={styles.backButton} onClick={handleBack}>
						{t("knowledgeDatabase.previousStep")}
					</Button>
					<Button type="primary" onClick={handleSubmit} disabled={!allowSubmit}>
						{t("knowledgeDatabase.nextStep")}
					</Button>
				</Flex>
			</Flex>
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		allowSubmit,
		previewIconUrl,
		uploadIconUrl,
		localFileList,
		enterpriseFileList,
		form,
		temporaryConfig,
		isDocumentConfig,
		queryKnowledgeBaseCode,
		queryDocumentCode,
		handleSubmit,
		dataSourceType,
		isPendingConfiguration,
	])

	return (
		<Flex className={styles.wrapper} vertical>
			<Flex className={styles.header} align="center" gap={14}>
				<MagicIcon
					component={IconChevronLeft}
					size={24}
					className={styles.arrow}
					onClick={handleBack}
				/>
				<div>{t("common.knowledgeDatabase")}</div>
			</Flex>
			{PageContent}
		</Flex>
	)
}
