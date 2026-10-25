import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Plus } from "lucide-react"

interface AiCanvasNewCardProps {
	creating: boolean
	disabled: boolean
	onCreate: () => void
}

/**
 * First cell of the "my canvases" grid: creates a blank canvas. It mirrors the project card's
 * 4:3 cover and two text lines so the grid stays aligned, but the whole card is one button
 * with a dashed outline, which marks it as an action rather than an existing canvas.
 */
function AiCanvasNewCard({ creating, disabled, onCreate }: AiCanvasNewCardProps) {
	const { t } = useTranslation("aiCanvas")

	return (
		<button
			type="button"
			onClick={onCreate}
			disabled={disabled}
			className="group flex flex-col gap-2 text-left focus-visible:outline-none disabled:cursor-not-allowed"
			data-testid="ai-canvas-new-card"
		>
			<span className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 transition-colors duration-200 group-hover:border-foreground/25 group-hover:bg-muted/60 group-focus-visible:ring-2 group-focus-visible:ring-ring group-disabled:opacity-60">
				<span className="flex size-11 items-center justify-center rounded-full bg-background text-foreground shadow-sm ring-1 ring-border transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
					{creating ? (
						<Loader2 size={16} className="animate-spin" aria-hidden="true" />
					) : (
						<Plus size={16} aria-hidden="true" />
					)}
				</span>
			</span>
			<span className="flex min-w-0 flex-col px-0.5">
				<span className="truncate text-sm font-medium text-foreground">
					{t("home.newCanvas")}
				</span>
				<span className="text-xs text-muted-foreground">{t("home.newCanvasHint")}</span>
			</span>
		</button>
	)
}

export default memo(AiCanvasNewCard)
