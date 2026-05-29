import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/constants/locale"
import { cn } from "@/lib/utils"
import { globalConfigStore } from "@/stores/globalConfig"
import { getAvatarUrl } from "@/utils/avatar"
import { MobileBrandLogoIcon } from "@/pages/superMagicMobile/components/icons/MobileBrandLogoIcon"

interface MobileBrandLogoProps {
	className?: string
	/** Display size in CSS pixels; CDN URL uses 2x for retina screens. */
	logoPixelSize?: number
}

/**
 * Renders platform minimal logo from global config, with SVG fallback before config loads.
 * Aligns with PC Header Logo data source; only the fallback UI is mobile-specific.
 */
export const MobileBrandLogo = observer(function MobileBrandLogo({
	className,
	logoPixelSize = 36,
}: MobileBrandLogoProps) {
	const { i18n } = useTranslation()
	const globalConfig = globalConfigStore.globalConfig
	const minimalLogo = globalConfig?.minimal_logo?.trim()
	const alt = globalConfig?.name_i18n?.[i18n.language as SupportLocales]

	if (minimalLogo) {
		return (
			<img
				src={getAvatarUrl(minimalLogo, logoPixelSize * 2)}
				alt={alt}
				draggable={false}
				className={cn("shrink-0 object-contain", className)}
			/>
		)
	}

	return <MobileBrandLogoIcon className={className} />
})
