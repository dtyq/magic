import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { IconHistory } from "@tabler/icons-react"
import MagicButton from "@/components/base/MagicButton"
import SettingItem from "@/components/settings/SettingItem"
import RecordingHistoryPanel from "@/components/business/RecordingSummary/components/RecordingHistoryPanel"

function DataExportPage() {
	const { t } = useTranslation("accountSetting")
	const [recordingHistoryOpen, setRecordingHistoryOpen] = useState(false)

	return (
		<div data-testid="account-setting-data-export-page">
			<SettingItem
				icon={<IconHistory size={22} />}
				title={t("recordingHistory")}
				description={t("recordingHistoryDescription")}
				extra={
					<MagicButton
						type="primary"
						ghost
						onClick={() => setRecordingHistoryOpen(true)}
						data-testid="account-setting-recording-history-open"
					>
						{t("viewRecordingHistory")}
					</MagicButton>
				}
				adaptMobile
			/>
			<RecordingHistoryPanel
				open={recordingHistoryOpen}
				onOpenChange={setRecordingHistoryOpen}
			/>
		</div>
	)
}

export default memo(DataExportPage)
