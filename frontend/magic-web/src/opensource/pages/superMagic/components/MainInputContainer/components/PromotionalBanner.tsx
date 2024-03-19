import { ArrowRight } from "lucide-react"
import { useTranslation } from "react-i18next"

interface PromotionalBannerProps {
	onCtaClick?: () => void
}

function PromotionalBanner({ onCtaClick }: PromotionalBannerProps) {
	const { t } = useTranslation("super/mainInput")

	return (
		<button
			className="flex items-center justify-center gap-3 rounded-full px-4 py-2 transition-opacity hover:opacity-90"
			style={{
				backgroundImage:
					"linear-gradient(5.01852deg, rgb(68, 56, 85) 0%, rgb(0, 0, 0) 100%)",
			}}
			onClick={onCtaClick}
		>
			<p className="text-sm leading-5 text-white">{t("promotionalBanner.upgradeMessage")}</p>
			<div className="flex items-center gap-0.5">
				<ArrowRight className="size-5 text-yellow-500" />
			</div>
		</button>
	)
}

export default PromotionalBanner
