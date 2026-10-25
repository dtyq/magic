import { useResponsive } from "ahooks"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/constants/locale"
import { globalConfigStore } from "@/stores/globalConfig"
import { observer } from "mobx-react-lite"
import { getAvatarUrl } from "@/utils/avatar"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/utils/cn"

// Tenant-provided logos keep their aspect ratio and stay inside the available header width.
const logoClassName = "h-full w-auto max-w-full object-contain text-foreground/40"

const DEFAULT_LOGO_HEIGHT = 80

function Logo({
	className,
	onClick,
	variant: _variant,
}: {
	className?: string
	onClick?: () => void
	variant?: "minimal" | "full"
}) {
	const responsive = useResponsive()
	const isSmallScreen = responsive.lg === false
	const { i18n } = useTranslation()

	const variant = _variant ?? (isSmallScreen ? "minimal" : undefined)

	const globalConfig = globalConfigStore.globalConfig

	const name = globalConfig?.name_i18n?.[i18n.language as SupportLocales]

	if (variant === "minimal" && globalConfig?.minimal_logo) {
		return (
			<div className={cn("min-w-0", className)} onClick={onClick}>
				<img
					className={logoClassName}
					src={getAvatarUrl(globalConfig.minimal_logo, DEFAULT_LOGO_HEIGHT)}
					alt={name}
				/>
			</div>
		)
	}

	if (i18n.language === SupportLocales.enUS && globalConfig?.logo?.[SupportLocales.enUS]) {
		return (
			<div className={cn("min-w-0", className)} onClick={onClick}>
				<img
					className={logoClassName}
					src={getAvatarUrl(
						globalConfig.logo?.[SupportLocales.enUS],
						DEFAULT_LOGO_HEIGHT,
					)}
					alt={name}
				/>
			</div>
		)
	}

	if (i18n.language === SupportLocales.zhCN && globalConfig?.logo?.[SupportLocales.zhCN]) {
		return (
			<div className={cn("min-w-0", className)} onClick={onClick}>
				<img
					className={logoClassName}
					src={getAvatarUrl(
						globalConfig.logo?.[SupportLocales.zhCN],
						DEFAULT_LOGO_HEIGHT,
					)}
					alt={name}
				/>
			</div>
		)
	}

	return <Spinner className="h-4 w-4 animate-spin" />
}

export default observer(Logo)
