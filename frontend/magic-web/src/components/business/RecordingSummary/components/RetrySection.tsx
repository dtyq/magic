import FlexBox from "@/components/base/FlexBox"
import MagicIcon from "@/components/base/MagicIcon"
import { IconAlertTriangle } from "@tabler/icons-react"
import { useStyles } from "./PcFloatPanel/style"
import MagicButton from "@/components/base/MagicButton"
import { useTranslation } from "react-i18next"
import { memo } from "react"

function RetrySection({ onRetryVoiceService }: { onRetryVoiceService: () => void }) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	return (
		<FlexBox
			className={styles.errorContainer}
			align="center"
			justify="space-between"
			gap={10}
			onClick={() => {
				onRetryVoiceService()
			}}
		>
			<FlexBox align="center" gap={4}>
				<MagicIcon component={IconAlertTriangle} size={16} color="currentColor" />
				{t("recordingSummary.actions.retryVoiceService")}
			</FlexBox>
			<MagicButton type="link" size="small">
				{t("recordingSummary.actions.retry")}
			</MagicButton>
		</FlexBox>
	)
}

export default memo(RetrySection)
