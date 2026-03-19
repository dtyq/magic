import { useTranslation } from "react-i18next"
import { usePoppinsFont } from "@/styles/font"

export default function SloganSection() {
	const { t } = useTranslation("super/mainInput")
	usePoppinsFont()

	return (
		<div className="flex w-full shrink-0 flex-col items-center gap-3 pb-8">
			<div className="shrink-0 font-poppins text-base font-light leading-none text-foreground">
				{t("sloganContainer.subtitle")}
			</div>
			<div className="shrink-0 font-poppins text-xl font-light leading-none text-foreground">
				{t("sloganContainer.title")}
			</div>
		</div>
	)
}
