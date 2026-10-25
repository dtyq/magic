import MagicIcon from "@/components/base/MagicIcon"
import type { AudioProcessingMode } from "@/services/recordSummary/MediaRecorderService/types/RecorderTypes"
import { IconAlertTriangle } from "@tabler/icons-react"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"
import { useStyles } from "./style"

interface CompatibilityRecordingNoticeProps {
	processingMode?: AudioProcessingMode | null
	isAudioProjectMode: boolean
	isExpanded: boolean
}

export function CompatibilityRecordingNotice({
	processingMode,
	isAudioProjectMode,
	isExpanded,
}: CompatibilityRecordingNoticeProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	if (!isAudioProjectMode || processingMode !== "script-processor") return null

	const title = t("mobile.recordingEntry.active.compatibilityModeTitle")
	const description = t("mobile.recordingEntry.active.compatibilityModeDescription")

	if (!isExpanded) {
		return (
			<Tooltip title={description}>
				<span className={styles.compatibilityModeIcon} aria-label={title}>
					<MagicIcon component={IconAlertTriangle} size={15} />
				</span>
			</Tooltip>
		)
	}

	return (
		<div
			className={styles.compatibilityModeNotice}
			role="status"
			data-testid="record-summary-pc-float-panel-compatibility-notice"
		>
			<MagicIcon
				component={IconAlertTriangle}
				className={styles.compatibilityModeIcon}
				size={16}
			/>
			<div className={styles.compatibilityModeDescription}>{description}</div>
		</div>
	)
}
