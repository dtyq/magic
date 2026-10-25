import { memo } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"

interface AIPolishButtonProps {
	onClick: () => void
	loading?: boolean
	disabled?: boolean
}

/**
 * AI Polish button — icon-only with tooltip.
 * Triggers AI text refinement while preserving @mention nodes.
 */
const AIPolishButton = memo(({ onClick, loading, disabled }: AIPolishButtonProps) => {
	const { t } = useTranslation("super")

	return (
		<MagicTooltip title={t("detail.aiCard.form.aiPolish", "AI 润色")} placement="left">
			<button
				type="button"
				onClick={onClick}
				disabled={disabled || loading}
				className={cn(
					"flex h-7 w-7 items-center justify-center rounded-md",
					"text-muted-foreground hover:text-primary hover:bg-primary/10",
					"transition-colors duration-150",
					"disabled:pointer-events-none disabled:opacity-50",
				)}
			>
				{loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
			</button>
		</MagicTooltip>
	)
})

AIPolishButton.displayName = "AIPolishButton"

export default AIPolishButton
