import { Form, Flex, Select, Switch, Tooltip, Slider, InputNumber, Input } from "antd"
import { useTranslation } from "react-i18next"
import { IconHelp, IconBlocks, IconFileDescription, IconBox } from "@tabler/icons-react"
import { useVectorKnowledgeConfigurationStyles } from "../styles"
import PatternSection from "./PatternSection"
import { RetrievalMethod } from "../../../constant"
import { useMemoizedFn } from "ahooks"

interface SearchSettingsGroupProps {
	isDocumentConfig: boolean
}

// 可用的重排序模型列表
const RERANK_MODELS: { label: string; value: string }[] = []

/**
 * 检索设置组件组（包含三种搜索模式）
 */
export default function SearchSettingsGroup({ isDocumentConfig }: SearchSettingsGroupProps) {
	const { styles } = useVectorKnowledgeConfigurationStyles()
	const { t } = useTranslation("flow")

	const form = Form.useFormInstance()

	const searchMethod = Form.useWatch(["retrieve_config", "search_method"])
	const rerankEnabled = Form.useWatch(["retrieve_config", "reranking_enable"])
	const scoreThresholdEnabled = Form.useWatch(["retrieve_config", "score_threshold_enabled"])

	const handleSearchMethodChange = useMemoizedFn((method: RetrievalMethod) => {
		form.setFieldValue(["retrieve_config", "search_method"], method)
	})

	/**
	 * 渲染重排模型设置
	 */
	const renderRerankSetting = () => (
		<Form.Item
			layout="vertical"
			style={{ marginBottom: "14px" }}
			label={
				<Flex align="center" gap={10}>
					<Flex align="center" gap={4}>
						{t("knowledgeDatabase.rerankModel")}
						<Tooltip title={t("knowledgeDatabase.rerankModelDesc")}>
							<IconHelp className={styles.iconHelp} />
						</Tooltip>
					</Flex>

					<Form.Item
						name={["retrieve_config", "reranking_enable"]}
						valuePropName="checked"
						noStyle
					>
						<Switch disabled={isDocumentConfig} size="small" />
					</Form.Item>
				</Flex>
			}
		>
			<Flex align="center" gap={12}>
				<Form.Item name={["retrieve_config", "reranking_model", "model_id"]} noStyle>
					<Select
						placeholder={t("knowledgeDatabase.rerankModelPlaceholder")}
						disabled={!rerankEnabled || isDocumentConfig}
						style={{ width: "100%" }}
						options={RERANK_MODELS}
					/>
				</Form.Item>
			</Flex>
		</Form.Item>
	)

	/**
	 * 渲染Top K设置
	 */
	const renderTopKSetting = () => (
		<Form.Item
			layout="vertical"
			className={styles.formItem}
			label={
				<Flex align="center" gap={4}>
					Top K
					<Tooltip title={t("knowledgeDatabase.topKDesc")}>
						<IconHelp className={styles.iconHelp} />
					</Tooltip>
				</Flex>
			}
		>
			<Flex justify="space-between" gap={10}>
				<Form.Item
					name={["retrieve_config", "top_k"]}
					noStyle
					getValueProps={(value) => ({ value: Number(value) })}
				>
					<Slider
						style={{ flex: 1 }}
						min={1}
						max={10}
						step={1}
						disabled={isDocumentConfig}
					/>
				</Form.Item>
				<Form.Item
					name={["retrieve_config", "top_k"]}
					noStyle
					getValueProps={(value) => ({ value: Number(value) })}
				>
					<InputNumber min={1} max={10} step={1} disabled={isDocumentConfig} />
				</Form.Item>
			</Flex>
		</Form.Item>
	)

	/**
	 * 渲染分数阈值设置
	 */
	const renderScoreThresholdSetting = () => (
		<Form.Item
			layout="vertical"
			className={styles.formItem}
			label={
				<Flex align="center" gap={10}>
					<Flex align="center" gap={4}>
						{t("knowledgeDatabase.scoreThreshold")}
						<Tooltip title={t("knowledgeDatabase.scoreThresholdDesc")}>
							<IconHelp className={styles.iconHelp} />
						</Tooltip>
					</Flex>

					<Form.Item
						name={["retrieve_config", "score_threshold_enabled"]}
						valuePropName="checked"
						noStyle
					>
						<Switch size="small" disabled={isDocumentConfig} />
					</Form.Item>
				</Flex>
			}
		>
			<Flex justify="space-between" gap={10}>
				<Form.Item
					name={["retrieve_config", "score_threshold"]}
					noStyle
					getValueProps={(value) => ({ value: Number(value) })}
				>
					<Slider
						disabled={!scoreThresholdEnabled || isDocumentConfig}
						style={{ flex: 1 }}
						min={0}
						max={1}
						step={0.01}
					/>
				</Form.Item>
				<Form.Item
					name={["retrieve_config", "score_threshold"]}
					noStyle
					getValueProps={(value) => ({ value: Number(value) })}
				>
					<InputNumber
						disabled={!scoreThresholdEnabled || isDocumentConfig}
						min={0}
						max={1}
						step={0.01}
					/>
				</Form.Item>
			</Flex>
		</Form.Item>
	)

	return (
		<>
			<Form.Item name={["retrieve_config", "search_method"]} noStyle>
				<Input type="hidden" />
			</Form.Item>

			{/* 向量搜索 */}
			<PatternSection
				title={t("knowledgeDatabase.vectorSearch")}
				description={t("knowledgeDatabase.vectorSearchDesc")}
				icon={IconBlocks}
				iconColor="blue"
				isActive={searchMethod === RetrievalMethod.SemanticSearch}
				onClick={() => handleSearchMethodChange(RetrievalMethod.SemanticSearch)}
			>
				{renderRerankSetting()}

				<Flex justify="space-between" gap={10}>
					{renderTopKSetting()}
					{renderScoreThresholdSetting()}
				</Flex>
			</PatternSection>

			{/* 全文搜索 */}
			<PatternSection
				title={t("knowledgeDatabase.fullTextSearch")}
				description={t("knowledgeDatabase.fullTextSearchDesc")}
				icon={IconFileDescription}
				iconColor="yellow"
				isActive={searchMethod === RetrievalMethod.FullTextSearch}
				onClick={() => handleSearchMethodChange(RetrievalMethod.FullTextSearch)}
			>
				{renderRerankSetting()}
				{renderTopKSetting()}
			</PatternSection>

			{/* 混合搜索 */}
			<PatternSection
				title={t("knowledgeDatabase.hybridSearch")}
				description={t("knowledgeDatabase.hybridSearchDesc")}
				icon={IconBox}
				iconColor="green"
				isActive={searchMethod === RetrievalMethod.HybridSearch}
				onClick={() => handleSearchMethodChange(RetrievalMethod.HybridSearch)}
			>
				{renderRerankSetting()}

				<Flex justify="space-between" gap={10}>
					{renderTopKSetting()}
					{renderScoreThresholdSetting()}
				</Flex>
			</PatternSection>
		</>
	)
}
