import { memo } from "react"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
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
		<Tabs
			value={value}
			onValueChange={(nextView) => onChange(nextView as SelfMediaView)}
			className={cn("w-max max-w-none shrink-0 flex-row gap-0 max-sm:w-full", className)}
			data-testid="self-media-view-tabs"
		>
			<TabsList className="h-10 w-max max-w-none shrink-0 justify-start overflow-visible rounded-[14px] bg-[#efeff0] p-1 sm:h-12 sm:rounded-[18px]">
				{visibleOrder.map((view) => {
					return (
						<TabsTrigger
							key={view}
							value={view}
							data-testid={`self-media-view-${view}`}
							className="h-8 min-w-[68px] shrink-0 rounded-[10px] px-2 text-xs font-[700] text-[#18181b] data-[state=active]:bg-white data-[state=active]:shadow-[0_3px_10px_rgba(24,24,27,0.06)] sm:h-10 sm:min-w-[92px] sm:rounded-[14px] sm:px-4 sm:text-sm"
						>
							{labels?.[view] || defaultLabels[view]}
						</TabsTrigger>
					)
				})}
			</TabsList>
		</Tabs>
	)
}

export default memo(ViewTabs)
