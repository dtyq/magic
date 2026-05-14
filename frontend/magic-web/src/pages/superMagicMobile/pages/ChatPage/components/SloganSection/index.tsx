import { useTranslation } from "react-i18next"
import { usePoppinsFont } from "@/styles/font"
import { globalConfigStore } from "@/stores/globalConfig"

export default function SloganSection() {
	const { t } = useTranslation("super")
	usePoppinsFont([300])

	const globalConfig = globalConfigStore.globalConfig

	const sloganImage = globalConfig?.minimal_logo

	return (
		<div className="flex w-full max-w-[348px] shrink-0 flex-col items-center gap-3 px-6 text-center">
			{sloganImage && (
				<img
					src={sloganImage}
					alt={t("mobile.shell.brandName")}
					className="h-20 w-20 shrink-0"
					draggable={false}
				/>
			)}
			<p className="shrink-0 font-poppins text-base leading-6 text-muted-foreground">
				{t("home.sloganSubtitle")}
			</p>
			<p className="shrink-0 font-poppins text-2xl font-medium leading-[1.18] tracking-[-0.03em] text-foreground">
				{t("home.sloganTitle")}
			</p>
		</div>
	)
}
