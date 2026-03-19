import { Form, Input } from "antd"
import { useTranslation } from "react-i18next"
import GeneralSegmentSection from "./GeneralSegmentSection"
import ParentChildSegmentSection from "./ParentChildSegmentSection"
import { SegmentationMode, ParentBlockMode } from "../../../constant"
import { useVectorKnowledgeConfigurationStyles } from "../styles"

interface SegmentSettingsSectionProps {
	disabled: boolean
	segmentMode: SegmentationMode
	parentBlockType: ParentBlockMode
	segmentPreviewLoading: boolean
	handleSegmentModeChange: (mode: SegmentationMode) => void
	handleParentBlockTypeChange: (type: ParentBlockMode) => void
	handleSegmentPreview: () => void
	handleSegmentSettingReset: (mode: SegmentationMode) => void
}

/**
 * 分段设置区域组件
 */
export default function SegmentSettingsSection({
	disabled,
	segmentMode,
	parentBlockType,
	segmentPreviewLoading,
	handleSegmentModeChange,
	handleParentBlockTypeChange,
	handleSegmentPreview,
	handleSegmentSettingReset,
}: SegmentSettingsSectionProps) {
	const { t } = useTranslation("flow")
	const { styles } = useVectorKnowledgeConfigurationStyles()

	return (
		<div className={styles.configSection}>
			<div className={styles.configTitle}>{t("knowledgeDatabase.segmentSettings")}</div>

			<Form.Item name={["fragment_config", "mode"]} noStyle>
				<Input type="hidden" />
			</Form.Item>

			<Form.Item name={["fragment_config", "normal"]} noStyle>
				<Input type="hidden" />
			</Form.Item>

			<Form.Item name={["fragment_config", "parent_child"]} noStyle>
				<Input type="hidden" />
			</Form.Item>

			{/* 通用模式区块 */}
			<GeneralSegmentSection
				disabled={disabled}
				isActive={segmentMode === SegmentationMode.General}
				segmentPreviewLoading={segmentPreviewLoading}
				onClick={() => handleSegmentModeChange(SegmentationMode.General)}
				onPreview={handleSegmentPreview}
				onReset={() => handleSegmentSettingReset(SegmentationMode.General)}
			/>

			{/* 父子模式区块 */}
			<ParentChildSegmentSection
				disabled={disabled}
				isActive={segmentMode === SegmentationMode.ParentChild}
				parentBlockType={parentBlockType}
				segmentPreviewLoading={segmentPreviewLoading}
				onClick={() => handleSegmentModeChange(SegmentationMode.ParentChild)}
				onParentBlockTypeChange={handleParentBlockTypeChange}
				onPreview={handleSegmentPreview}
				onReset={() => handleSegmentSettingReset(SegmentationMode.ParentChild)}
			/>
		</div>
	)
}
