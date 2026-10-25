import { Globe2 } from "lucide-react"
import { useTranslation } from "react-i18next"

export default function MicroAppNoOpenPages() {
	const { t } = useTranslation("super")
	return (
		<div
			className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"
			data-testid="micro-app-no-open-pages"
		>
			<Globe2 size={16} />
			<p className="text-sm font-medium text-foreground">
				{t("microAppPage.previewToolbar.noOpenPages")}
			</p>
			<p className="text-xs">{t("microAppPage.previewToolbar.openPageHint")}</p>
		</div>
	)
}
