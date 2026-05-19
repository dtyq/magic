import MagicLogoNew from "@/components/MagicLogo/MagicLogoNew"
import { memo } from "react"
import { useTranslation } from "react-i18next"

const TopMeta = memo(function TopMeta() {
	const { t } = useTranslation("login")
	return (
		<div className="z-[1] flex flex-col items-center justify-center">
			<div className="mb-[37px] flex min-h-10 w-40 items-center justify-center">
				<MagicLogoNew className="w-40" />
			</div>
			<div className="mb-1 w-full text-foreground">{t("hi")}</div>
			<span className="text-xl font-semibold leading-7 text-foreground">{t("welcome")}</span>
		</div>
	)
})

export default TopMeta
