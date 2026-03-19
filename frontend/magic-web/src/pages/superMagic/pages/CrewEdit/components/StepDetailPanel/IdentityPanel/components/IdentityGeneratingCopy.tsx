import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"

export function IdentityGeneratingCopy() {
	const { t } = useTranslation("crew/create")

	return (
		<div
			className="flex flex-col items-center gap-3"
			data-testid="crew-identity-generating-status"
		>
			<p className="font-['Poppins:Regular',sans-serif] text-2xl leading-none text-foreground">
				{t("card.generating.title")}
			</p>
			<p className="text-sm leading-5 text-muted-foreground">
				{t("card.generating.subtitle")}
			</p>
			<div className="animate-spin" data-testid="crew-identity-generating-loader">
				<Loader2 className="h-6 w-6 text-foreground" />
			</div>
		</div>
	)
}
