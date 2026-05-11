import { memo } from "react"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import type { SelfMediaView } from "../types"

interface ViewTabsProps {
	value: SelfMediaView
	onChange: (view: SelfMediaView) => void
	labels?: Partial<Record<SelfMediaView, string>>
	/** Override visible tab order; defaults to all four views */
	order?: SelfMediaView[]
	className?: string
}

const DEFAULT_ORDER: SelfMediaView[] = ["feed", "detail", "scroll", "edit", "code"]

function ViewTabs({ value, onChange, labels, order, className }: ViewTabsProps) {
	const { t } = useTranslation("super")
	const defaultLabels: Record<SelfMediaView, string> = {
		feed: t("detail.selfMedia.viewTabs.feed"),
		detail: t("detail.selfMedia.viewTabs.detail"),
		scroll: t("detail.selfMedia.viewTabs.scroll"),
		edit: t("detail.selfMedia.viewTabs.edit"),
		code: t("detail.selfMedia.viewTabs.code"),
	}
	const visibleOrder = order && order.length > 0 ? order : DEFAULT_ORDER

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1 rounded-full border border-border bg-background p-1 text-xs",
				className,
			)}
			data-testid="self-media-view-tabs"
		>
			{visibleOrder.map((view) => {
				const active = view === value
				return (
					<button
						key={view}
						type="button"
						onClick={() => onChange(view)}
						data-testid={`self-media-view-${view}`}
						className={cn(
							"min-w-[72px] rounded-full px-3 py-1 transition",
							active
								? "bg-foreground text-background"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{labels?.[view] || defaultLabels[view]}
					</button>
				)
			})}
		</div>
	)
}

export default memo(ViewTabs)
