import { useTranslation } from "react-i18next"
import { usePoppinsFont } from "@/styles/font"
import { globalConfigStore } from "@/stores/globalConfig"

export default function SloganSection() {
	const { t } = useTranslation("super/mainInput")
	usePoppinsFont([300])

	const globalConfig = globalConfigStore.globalConfig

	const sloganImage = globalConfig?.minimal_logo

	return (
		<div className="flex w-full max-w-[340px] shrink-0 flex-col items-center gap-2.5 px-6 text-center">
			{sloganImage && (
				<img
					src={sloganImage}
					alt="slogan"
					className="size-20 shrink-0"
					draggable={false}
				/>
			)}
			<p className="shrink-0 font-poppins text-sm leading-snug text-muted-foreground">
				{t("sloganContainer.subtitle")}
			</p>
			<p className="shrink-0 font-poppins text-2xl font-medium leading-tight text-foreground">
				{t("sloganContainer.title")}
			</p>
		</div>
	)
}
