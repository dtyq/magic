import { Form, Input, Flex, Divider, InputNumber } from "antd"
import { IconLayoutNavbar, IconBlockquote, IconFileDescription } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import PatternSection from "./PatternSection"
import TextPreprocessRule from "./TextPreprocessRule"
import CheckboxItem from "./CheckboxItem"
import { ParentBlockMode } from "../../../constant"
import { useVectorKnowledgeConfigurationStyles } from "../styles"

interface ParentChildSegmentSectionProps {
	disabled: boolean
	isActive: boolean
	parentBlockType: ParentBlockMode
	segmentPreviewLoading: boolean
	onClick: () => void
	onParentBlockTypeChange: (type: ParentBlockMode) => void
	onPreview: () => void
	onReset: () => void
}

/**
 * 父子分段模式组件
 */
export default function ParentChildSegmentSection({
	disabled,
	isActive,
	parentBlockType,
	segmentPreviewLoading,
	onClick,
	onParentBlockTypeChange,
	onPreview,
	onReset,
}: ParentChildSegmentSectionProps) {
	const { t } = useTranslation("flow")
	const { styles } = useVectorKnowledgeConfigurationStyles()

	return (
		<PatternSection
			title={t("knowledgeDatabase.parentChildSegment")}
			description={t("knowledgeDatabase.parentChildSegmentDesc")}
			icon={IconLayoutNavbar}
			iconColor="yellow"
			isActive={isActive}
			onClick={onClick}
		>
			<div className={styles.subSectionTitle}>{t("knowledgeDatabase.parentContext")}</div>

			<Form.Item name={["fragment_config", "parent_child", "parent_mode"]} noStyle>
				<Input type="hidden" />
			</Form.Item>

			<Flex vertical gap={10}>
				{/* 段落 */}
				<div className={styles.subSection}>
					<Flex
						justify="space-between"
						align="center"
						onClick={() => onParentBlockTypeChange(ParentBlockMode.Paragraph)}
					>
						<Flex align="center" gap={8}>
							<Flex align="center" justify="center" className={styles.patternIcon}>
								<MagicIcon component={IconBlockquote} color="#315CEC" />
							</Flex>
							<div>
								<div className={styles.patternTitle}>
									{t("knowledgeDatabase.paragraph")}
								</div>
								<div className={styles.patternDesc}>
									{t("knowledgeDatabase.paragraphDesc")}
								</div>
							</div>
						</Flex>
						<CheckboxItem checked={parentBlockType === ParentBlockMode.Paragraph} />
					</Flex>
					<Flex gap={10} className={styles.subSectionContent}>
						<Form.Item
							className={styles.formItem}
							name={[
								"fragment_config",
								"parent_child",
								"parent_segment_rule",
								"separator",
							]}
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
							name={[
								"fragment_config",
								"parent_child",
								"parent_segment_rule",
								"chunk_size",
							]}
							label={<div>{t("knowledgeDatabase.segmentMaxSize")}</div>}
							rules={[
								{
									required: true,
									message: t("knowledgeDatabase.segmentMaxSizeTip"),
								},
							]}
						>
							<InputNumber
								style={{ width: "100%" }}
								suffix="Tokens"
								disabled={disabled}
							/>
						</Form.Item>
					</Flex>
				</div>

				{/* 全文 */}
				<div className={styles.subSection}>
					<Flex
						justify="space-between"
						align="center"
						onClick={() => onParentBlockTypeChange(ParentBlockMode.FullText)}
					>
						<Flex align="center" gap={8}>
							<Flex align="center" justify="center" className={styles.patternIcon}>
								<MagicIcon component={IconFileDescription} color="#FF7D00" />
							</Flex>
							<div>
								<div className={styles.patternTitle}>
									{t("knowledgeDatabase.fullText")}
								</div>
								<div className={styles.patternDesc}>
									{t("knowledgeDatabase.fullTextDesc")}
								</div>
							</div>
						</Flex>
						<CheckboxItem checked={parentBlockType === ParentBlockMode.FullText} />
					</Flex>
				</div>
			</Flex>

			<Divider className={styles.divider} />

			<div className={styles.subSectionTitle}>{t("knowledgeDatabase.childContext")}</div>

			<Flex gap={10}>
				<Form.Item
					className={styles.formItem}
					name={["fragment_config", "parent_child", "child_segment_rule", "separator"]}
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
					name={["fragment_config", "parent_child", "child_segment_rule", "chunk_size"]}
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
			</Flex>

			<Divider className={styles.divider} />

			<TextPreprocessRule
				disabled={disabled}
				namePathPrefix={["fragment_config", "parent_child"]}
				allowPreview={!segmentPreviewLoading}
				onPreview={onPreview}
				onReset={onReset}
			/>
		</PatternSection>
	)
}
