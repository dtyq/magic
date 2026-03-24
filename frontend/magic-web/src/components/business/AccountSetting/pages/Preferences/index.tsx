import { memo } from "react"
import { useTranslation } from "react-i18next"
import LanguageSwitch from "@/components/settings/LanguageSwitch"
import SettingItem from "@/components/settings/SettingItem"
import { isLanguageSwitchEnabled } from "@/models/config/languagePolicy"

function PreferencesPage() {
	const { t } = useTranslation("interface")
	if (!isLanguageSwitchEnabled()) return null

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
