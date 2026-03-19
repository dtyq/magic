import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/constants/locale"
import { globalConfigStore } from "@/stores/globalConfig"
import { observer } from "mobx-react-lite"

function FooterLogo() {
	const { i18n } = useTranslation()
	const globalConfig = globalConfigStore.globalConfig

	if (!globalConfig?.minimal_logo) return null

	return (
		<img
			src={globalConfig.minimal_logo}
			alt={globalConfig.name_i18n?.[i18n.language as SupportLocales]}
		/>
	)
}

export default observer(FooterLogo)
