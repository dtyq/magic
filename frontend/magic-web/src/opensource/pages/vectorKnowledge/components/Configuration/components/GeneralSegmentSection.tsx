import { Form, Input, Flex, Divider, InputNumber } from "antd"
import { IconLayoutList } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import PatternSection from "./PatternSection"
import TextPreprocessRule from "./TextPreprocessRule"
import { useVectorKnowledgeConfigurationStyles } from "../styles"

interface GeneralSegmentSectionProps {
	disabled: boolean
	isActive: boolean
	segmentPreviewLoading: boolean
	onClick: () => void
	onPreview: () => void
	onReset: () => void
}

/**
 * 通用分段模式组件
 */
export default function GeneralSegmentSection({
	disabled,
	isActive,
	segmentPreviewLoading,
	onClick,
	onPreview,
	onReset,
}: GeneralSegmentSectionProps) {
	const { t } = useTranslation("flow")
	const { styles } = useVectorKnowledgeConfigurationStyles()

	return (
		<PatternSection
			title={t("knowledgeDatabase.generalPattern")}
			description={t("knowledgeDatabase.generalPatternDesc")}
			icon={IconLayoutList}
			iconColor="blue"
			isActive={isActive}
			onClick={onClick}
		>
			<Flex gap={10}>
				<Form.Item
					className={styles.formItem}
					name={["fragment_config", "normal", "segment_rule", "separator"]}
					label={<div>{t("knowledgeDatabase.segmentDelimiter")}</div>}
					tooltip={t("knowledgeDatabase.segmentDelimiterDesc")}
					rules={[
						{
							required: true,
							message: t("knowledgeDatabase.segmentDelimiterTip"),
						},
					]}
				>
					<Input disabled={disabled} />
				</Form.Item>
				<Form.Item
					className={styles.formItem}
					name={["fragment_config", "normal", "segment_rule", "chunk_size"]}
					label={<div>{t("knowledgeDatabase.segmentMaxSize")}</div>}
					rules={[
						{
							required: true,
							message: t("knowledgeDatabase.segmentMaxSizeTip"),
						},
					]}
				>
					<InputNumber style={{ width: "100%" }} suffix="Tokens" disabled={disabled} />
				</Form.Item>

				<Form.Item
					className={styles.formItem}
					name={["fragment_config", "normal", "segment_rule", "chunk_overlap"]}
					label={<div>{t("knowledgeDatabase.segmentOverlapSize")}</div>}
					rules={[
						{
							required: true,
							message: t("knowledgeDatabase.segmentOverlapSizeTip"),
						},
					]}
					tooltip={t("knowledgeDatabase.segmentOverlapSizeDesc")}
				>
					<InputNumber style={{ width: "100%" }} suffix="Tokens" disabled={disabled} />
				</Form.Item>
			</Flex>
			<Divider className={styles.divider} />
			<TextPreprocessRule
				disabled={disabled}
				namePathPrefix={["fragment_config", "normal"]}
				allowPreview={!segmentPreviewLoading}
				onPreview={onPreview}
				onReset={onReset}
			/>
		</PatternSection>
	)
}
