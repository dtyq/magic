import { memo, useCallback, CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { isPrivateDeployment } from "@/opensource/utils/env"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import { globalConfigStore } from "@/opensource/stores/globalConfig"
import { useStyles } from "./styles"
import MagicNewLogo from "@/opensource/assets/logos/magic-ip.png"

interface CreatedByBadgeProps {
	visible?: boolean
	style?: CSSProperties
}

function CreatedByBadge({ visible = true, style }: CreatedByBadgeProps) {
	const { styles } = useStyles()
	const { t, i18n } = useTranslation("super")
	const globalConfig = globalConfigStore.globalConfig

	const handleClick = useCallback(() => {
		window.open(window.location.origin, "_blank", "noopener,noreferrer")
	}, [])

	if (!visible) return null

	const isEnglish = i18n.language === "en_US" || i18n.language === "en"

	return (
		<div className={styles.badge} onClick={handleClick} style={style}>
			{isPrivateDeployment() ? (
				<img
					src={getAvatarUrl(globalConfig?.minimal_logo || "", 35)}
					alt=""
					className={styles.logo}
				/>
			) : (
				<img src={MagicNewLogo} alt="SuperMagic" className={styles.logo} />
			)}
			<div className={styles.textContainer}>
				{isEnglish ? (
					<>
						<span className={styles.prefixText}>{t("share.createdBy.prefix")}</span>
						<span className={styles.brandText}>{t("share.createdBy.brand")}</span>
					</>
				) : (
					<>
						<span className={styles.prefixText}>{t("share.createdBy.prefix")}</span>
						<span className={styles.brandText}>{t("share.createdBy.brand")}</span>
						<span className={styles.suffixText}>{t("share.createdBy.suffix")}</span>
					</>
				)}
			</div>
		</div>
	)
}

export default memo(CreatedByBadge)
