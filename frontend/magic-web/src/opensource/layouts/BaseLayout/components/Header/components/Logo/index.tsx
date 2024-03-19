import { useResponsive } from "ahooks"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"
import { SupportLocales } from "@/opensource/constants/locale"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { observer } from "mobx-react-lite"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import LoadingOutlined from "@/opensource/components/icons/LoadingOutlined"

const useStyles = createStyles(({ css, token }) => {
	return {
		logo: css`
			height: 100%;
			width: auto;
			color: ${token.magicColorUsages.text[3]};
		`,
	}
})

const DEFAULT_LOGO_HEIGHT = 42

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
	const { styles } = useStyles()

	const variant = _variant ?? (isSmallScreen ? "minimal" : undefined)

	const globalConfig = globalConfigStore.globalConfig

	const name = globalConfig?.name_i18n?.[i18n.language as SupportLocales]

	if (variant === "minimal" && globalConfig?.minimal_logo) {
		return (
			<div className={className} onClick={onClick}>
				<img
					className={styles.logo}
					src={getAvatarUrl(globalConfig.minimal_logo, DEFAULT_LOGO_HEIGHT)}
					alt={name}
				/>
			</div>
		)
	}

	if (i18n.language === SupportLocales.enUS && globalConfig?.logo?.[SupportLocales.enUS]) {
		return (
			<div className={className} onClick={onClick}>
				<img
					className={styles.logo}
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
			<div className={className} onClick={onClick}>
				<img
					className={styles.logo}
					src={getAvatarUrl(
						globalConfig.logo?.[SupportLocales.zhCN],
						DEFAULT_LOGO_HEIGHT,
					)}
					alt={name}
				/>
			</div>
		)
	}

	return <LoadingOutlined spin className={styles.logo} color="currentColor" />
}

export default observer(Logo)
