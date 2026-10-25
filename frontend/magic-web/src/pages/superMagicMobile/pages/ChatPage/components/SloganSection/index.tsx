import MobileBrandHero from "@/pages/superMagicMobile/components/MobileBrandHero"
import { useTranslation } from "react-i18next"

export default function SloganSection({ isChat = false }: { isChat?: boolean }) {
	const { t } = useTranslation("super/mainInput")
	return (
		<MobileBrandHero
			className="mt-0 px-6"
			titleClassName="flex min-h-[3.6em] items-center justify-center"
			subtitle={isChat ? t("chatHome.subtitle") : undefined}
			title={isChat ? t("chatHome.title") : undefined}
		/>
	)
}
