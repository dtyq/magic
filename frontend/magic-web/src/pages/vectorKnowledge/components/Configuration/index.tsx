import { Form, Button, Flex } from "antd"
import { useVectorKnowledgeConfigurationStyles } from "./styles"
import { useConfigurationLogic } from "./hooks/useConfigurationLogic"
import SegmentSettingsSection from "./components/SegmentSettingsSection"
import EmbeddingModelSection from "./components/EmbeddingModelSection"
import SearchSettingsGroup from "./components/SearchSettingsGroup"
import SegmentPreview from "./components/SegmentPreview"
import type { TemporaryKnowledgeConfig } from "../../types"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { useEffect } from "react"
import { history } from "@/routes/history"
import { RouteName } from "@/routes/constants"

interface Props {
	documentConfig?: {
		knowledgeBaseCode: string
		documentCode: string
	}
	knowledgeBase?: TemporaryKnowledgeConfig
	onBack: () => void
	handleConfigurationSubmit: (data: TemporaryKnowledgeConfig) => Promise<void>
}

/**
 * 向量知识库配置组件，有两种业务场景：
 * 1. 创建知识库时，用于配置知识库的分段设置、嵌入模型、检索设置；
 * 2. 知识库创建成功后，用于重新编辑文档维度的分段设置。
 */
export default function VectorKnowledgeConfiguration({
	documentConfig,
	knowledgeBase,
	onBack,
	handleConfigurationSubmit,
}: Props) {
	const { styles } = useVectorKnowledgeConfigurationStyles()

	const { t } = useTranslation("flow")

	/** 跳转文档列表 */
	const navigateToDocumentList = useMemoizedFn((knowledgeBaseCode: string) => {
		history.push({ name: RouteName.VectorKnowledgeDetail, query: { code: knowledgeBaseCode } })
	})

	const {
		form,
		currentDocumentDetail,
		isOldVersion,
		segmentMode,
		parentBlockType,
		embeddingModelOptions,
		segmentDocument,
		setSegmentDocument,
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
	} = useConfigurationLogic(
		navigateToDocumentList,
		knowledgeBase,
		handleConfigurationSubmit,
		documentConfig,
	)

	// 分段列表的每页条数
	const PAGE_SIZE = 20

	// 适配参数接口
	const handleGetFragmentList = useMemoizedFn(({ page }: { page: number }) => {
		if (currentDocumentDetail) {
			return getFragmentList({
				knowledgeBaseCode: currentDocumentDetail.knowledge_base_code,
				documentCode: currentDocumentDetail.code,
				page,
				pageSize: PAGE_SIZE,
			})
		}
	})

	// 初始化分段列表
	useEffect(() => {
		handleGetFragmentList({ page: 1 })
	}, [currentDocumentDetail])

	return (
		<Flex className={styles.wrapper}>
			{/* 左侧 - 知识库配置 */}
			<Flex vertical justify="space-between" className={styles.leftWrapper}>
				<div className={styles.container}>
					<div className={styles.title}>
						{currentDocumentDetail
							? currentDocumentDetail.name
							: t("knowledgeDatabase.createVectorKnowledge")}
						{isOldVersion && (
							<div className={styles.oldVersionTip}>
								{t("knowledgeDatabase.oldVersionTip")}
							</div>
						)}
					</div>
					<div className={styles.content}>
						<Form form={form} layout="vertical" initialValues={initialValues}>
							{/* 分段设置 */}
							<SegmentSettingsSection
								disabled={isOldVersion}
								segmentMode={segmentMode}
								parentBlockType={parentBlockType}
								segmentPreviewLoading={segmentPreviewLoading}
								handleSegmentModeChange={handleSegmentModeChange}
								handleParentBlockTypeChange={handleParentBlockTypeChange}
								handleSegmentPreview={handleSegmentPreviewClick}
								handleSegmentSettingReset={handleSegmentSettingReset}
							/>

							{/* Embedding模型 */}
							<EmbeddingModelSection
								isDocumentConfig={!!documentConfig}
								embeddingModelOptions={embeddingModelOptions}
							/>
							{/* 检索设置 */}
							<div className={styles.configSection}>
								<div className={styles.configTitle} style={{ marginBottom: 4 }}>
									{t("knowledgeDatabase.searchSettings")}
								</div>
								<div className={styles.configDesc}>
									{t("knowledgeDatabase.searchSettingsDesc")}
								</div>

								{/* 搜索设置组件组 */}
								<SearchSettingsGroup isDocumentConfig={!!documentConfig} />
							</div>
						</Form>
					</div>
				</div>

				<Flex className={styles.footer} justify="flex-end" align="center" gap={10}>
					<Button
						className={styles.backButton}
						loading={isSaving}
						disabled={isSaving}
						onClick={onBack}
					>
						{t("knowledgeDatabase.previousStep")}
					</Button>
					{!isOldVersion && (
						<Button
							type="primary"
							onClick={handleSaveConfiguration}
							loading={isSaving}
							disabled={isSaving}
						>
							{t("knowledgeDatabase.saveAndProcess")}
						</Button>
					)}
				</Flex>
			</Flex>

			{/* 右侧 - 分段预览 */}
			<Flex vertical className={styles.rightWrapper}>
				<SegmentPreview
					segmentPreviewLoading={segmentPreviewLoading}
					segmentDocument={segmentDocument}
					setSegmentDocument={setSegmentDocument}
					segmentDocumentOptions={segmentDocumentOptions}
					segmentPreviewResult={segmentPreviewResult}
					isOldVersion={isOldVersion}
					getFragmentList={handleGetFragmentList}
				/>
			</Flex>
		</Flex>
	)
}
