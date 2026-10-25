import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"

export const CONNECTOR_MARKET_GROUPS = {
	official: "official",
	mine: "mine",
	added: "added",
} as const

export type ConnectorMarketGroup =
	(typeof CONNECTOR_MARKET_GROUPS)[keyof typeof CONNECTOR_MARKET_GROUPS]

interface ConnectorCategoryFilterProps {
	value: ConnectorMarketGroup
	onChange: (value: ConnectorMarketGroup) => void
}

export default function ConnectorCategoryFilter({ value, onChange }: ConnectorCategoryFilterProps) {
	const { t } = useTranslation("crew/market")

	return (
		<HeadlessHorizontalScroll
			className="relative w-full"
			scrollContainerClassName="flex gap-2 overflow-x-auto py-1 pr-16 scrollbar-none"
			data-testid="connector-category-filter"
		>
			<div
				className="flex min-w-max gap-2"
				role="tablist"
				aria-label={t("connectors.category")}
			>
				{[
					{
						id: CONNECTOR_MARKET_GROUPS.official,
						label: t("connectors.official"),
					},
					{
						id: CONNECTOR_MARKET_GROUPS.mine,
						label: t("connectors.mine"),
					},
					{
						id: CONNECTOR_MARKET_GROUPS.added,
						label: t("connectors.addedList"),
					},
				].map((item) => {
					const active = item.id === value
					return (
						<Button
							key={item.id}
							variant={active ? "outline" : "secondary"}
							size="sm"
							role="tab"
							aria-selected={active}
							className={cn(
								"h-9 shrink-0 rounded-full border-[2px] shadow-xs transition-colors",
								active
									? "border-foreground bg-background text-foreground"
									: "border-transparent text-muted-foreground hover:text-foreground",
							)}
							data-testid={`connector-category-${item.id}`}
							onClick={() => onChange(item.id)}
						>
							{item.label}
						</Button>
					)
				})}
			</div>
		</HeadlessHorizontalScroll>
	)
}
