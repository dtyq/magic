import { globalConfigStore } from "@/stores/globalConfig"
import { observer } from "mobx-react-lite"

interface HeaderLogoProps {
	width?: number
}

function HeaderLogo({ width = 40 }: HeaderLogoProps) {
	const globalConfig = globalConfigStore.globalConfig

	if (!globalConfig?.minimal_logo) return null

	return <img src={globalConfig.minimal_logo} alt="" width={width} />
}

export default observer(HeaderLogo)
