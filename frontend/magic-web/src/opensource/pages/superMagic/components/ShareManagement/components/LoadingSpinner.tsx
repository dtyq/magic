import { memo } from "react"
import { IconLoader } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

function LoadingSpinner() {
	const { t } = useTranslation("super")

	return (
		<div className="flex h-full items-center justify-center">
			<div className="flex items-center gap-2 text-muted-foreground">
				<IconLoader size={20} className="animate-spin" />
				<span>{t("shareManagement.loading")}</span>
			</div>
		</div>
	)
}

export default memo(LoadingSpinner)
