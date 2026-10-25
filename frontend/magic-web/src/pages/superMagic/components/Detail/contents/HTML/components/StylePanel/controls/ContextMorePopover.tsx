import { useTranslation } from "react-i18next"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { STYLE_PANEL_STYLES } from "../styles"

interface ContextMorePopoverProps {
	disabled?: boolean
	onReveal: () => void
}

/**
 * Opens the sidebar More Styles section. The detailed controls live there.
 */
export function ContextMorePopover({ disabled = false, onReveal }: ContextMorePopoverProps) {
	const { t } = useTranslation("super")

	return (
		<Button
			variant="ghost"
			size="sm"
			className={`h-7 shrink-0 gap-1 px-2 ${STYLE_PANEL_STYLES.toolbarButton}`}
			disabled={disabled}
			aria-label={t("stylePanel.moreStyles")}
			data-testid="style-panel-more-styles-trigger"
			onClick={onReveal}
		>
			<MoreHorizontal className="h-4 w-4" />
			<span className="text-xs font-normal">{t("stylePanel.moreStyles")}</span>
		</Button>
	)
}
