import { memo } from "react"
import { useTranslation } from "react-i18next"
import LanguageSwitch from "@/opensource/components/settings/LanguageSwitch"
import SettingItem from "@/opensource/components/settings/SettingItem"

function PreferencesPage() {
	const { t } = useTranslation("interface")

	return (
		<div data-testid="account-setting-preferences-page">
			<SettingItem
				title={t("setting.language")}
				description={t("setting.languageDescription")}
				extra={<LanguageSwitch />}
				adaptMobile
			/>
		</div>
	)
}

export default memo(PreferencesPage)
