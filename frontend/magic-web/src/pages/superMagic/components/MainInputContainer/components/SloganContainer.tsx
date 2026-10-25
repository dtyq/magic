import { memo } from "react"
import { useTranslation } from "react-i18next"
import { usePoppinsFont } from "@/styles/font"

function SloganContainer({ variant = "task" }: { variant?: "chat" | "task" }) {
	const { t } = useTranslation("super/mainInput")
	usePoppinsFont([300])

	return (
		<div className="flex flex-col items-center gap-3 text-foreground">
			<p className="font-poppins text-2xl font-light">
				{variant === "chat" ? t("chatHome.subtitle") : t("sloganContainer.subtitle")}
			</p>
			<p className="font-poppins text-5xl font-light not-italic">
				{variant === "chat" ? t("chatHome.title") : t("sloganContainer.title")}
			</p>
		</div>
	)
}

export default memo(SloganContainer)
