import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Switch } from "@/components/shadcn-ui/switch"
import SettingItem from "@/components/settings/SettingItem"
import { useGlobalSuggestion } from "./hooks"

function FollowUpSuggestionItems() {
	const { t } = useTranslation("interface")

	const {
		followUpSuggestions,
		keepUsedFollowUpSuggestions,
		setFollowUpSuggestions,
		setKeepUsedFollowUpSuggestions,
	} = useGlobalSuggestion()

	return (
		<>
			<SettingItem
				title={t("setting.followUpSuggestionsAlwaysShow")}
				description={t("setting.followUpSuggestionsAlwaysShowDescription")}
				extra={
					<Switch
						checked={followUpSuggestions}
						onCheckedChange={setFollowUpSuggestions}
					/>
				}
				adaptMobile
			/>
			<SettingItem
				title={t("setting.followUpSuggestionsHistoryTurns")}
				description={t("setting.followUpSuggestionsHistoryTurnsDescription")}
				extra={
					<Switch
						checked={keepUsedFollowUpSuggestions}
						onCheckedChange={setKeepUsedFollowUpSuggestions}
					/>
				}
				adaptMobile
			/>
		</>
	)
}
export default observer(FollowUpSuggestionItems)
