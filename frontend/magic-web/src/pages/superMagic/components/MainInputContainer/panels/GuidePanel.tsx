import { observer } from "mobx-react-lite"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import CollapsiblePanel from "./CollapsiblePanel"
import { useLocaleText } from "./hooks/useLocaleText"
import { useGuideItemAction } from "./hooks/useGuideItemAction"
import type { GuidePanelConfig, GuideItem } from "./types"
import { useTranslation } from "react-i18next"

interface GuidePanelProps {
	config: GuidePanelConfig
	onItemClick?: (item: GuideItem) => void
}

const GuidePanel = observer(({ config, onItemClick }: GuidePanelProps) => {
	const { t } = useTranslation("crew/create")
	const lt = useLocaleText()
	const { executeAction } = useGuideItemAction()

	const handleItemClick = (item: GuideItem) => {
		executeAction(item)
		onItemClick?.(item)
	}

	const noData = config.guide?.items?.length === 0
	if (noData) {
		return null
	}

	return (
		<CollapsiblePanel
			title={lt(config.title) || t("playbook.edit.quickStart.title")}
			expandable={config.expandable}
			defaultExpanded={config.default_expanded}
		>
			<div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
				{config.guide.items.map((item) => (
					<div
						key={item.key}
						onClick={() => handleItemClick(item)}
						className="flex cursor-pointer items-center gap-2 overflow-clip rounded-md border border-border bg-background p-3.5 transition-colors hover:bg-accent"
					>
						{/* Icon Container */}
						{item.icon && (
							<div className="flex size-[50px] shrink-0 items-center justify-center">
								<div className="flex size-[42px] items-center justify-center rounded-lg bg-primary/10">
									<img src={item.icon} alt="icon" className="size-full" />
								</div>
							</div>
						)}

						{/* Content */}
						<div className="flex min-w-0 flex-1 flex-col gap-1">
							<p className="truncate text-sm font-medium leading-5 text-foreground">
								{lt(item.title)}
							</p>
							<p className="line-clamp-2 text-xs leading-none text-muted-foreground">
								{lt(item.description)}
							</p>
						</div>

						{/* Arrow Icon */}
						<div className="flex size-6 shrink-0 items-center justify-center">
							<LucideLazyIcon
								icon="ArrowRight"
								size={16}
								className="text-muted-foreground"
							/>
						</div>
					</div>
				))}
			</div>
		</CollapsiblePanel>
	)
})

GuidePanel.displayName = "GuidePanel"

export default GuidePanel
