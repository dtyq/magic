import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { RECYCLE_BIN_TABS_CONFIG, type RecycleBinTabId } from "@/pages/recycleBin/tab-config"

type RecycleBinTabValue = RecycleBinTabId

interface RecycleBinTabsProps {
	activeTab: RecycleBinTabValue
	onTabChange: (value: RecycleBinTabValue) => void
	tabCounts?: Record<string, number>
}

function RecycleBinTabs(props: RecycleBinTabsProps) {
	const { activeTab, onTabChange, tabCounts = {} } = props
	const { t } = useTranslation("super")

	return (
		<div className="w-full shrink-0 px-3 pb-3 pt-1" data-testid="mobile-recycle-bin-filter">
			<Tabs
				value={activeTab}
				onValueChange={(value) => onTabChange(value as RecycleBinTabValue)}
				className="w-full"
				data-testid="mobile-recycle-bin-tabs"
			>
				<TabsList
					className="no-scrollbar h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-0"
					data-testid="mobile-recycle-bin-tabs-list"
				>
					{RECYCLE_BIN_TABS_CONFIG.map((tab) => (
						<TabsTrigger
							key={tab.id}
							value={tab.id}
							className="h-9 shrink-0 rounded-full px-4 text-[15px] font-medium text-muted-foreground/80 transition-all hover:text-foreground active:scale-95 data-[state=active]:bg-[#F1F3F5] data-[state=active]:text-foreground"
							data-testid={`mobile-recycle-bin-tab-${tab.id}`}
						>
							{t(tab.labelKey.mobile, { count: tabCounts[tab.id] ?? 0 })}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
		</div>
	)
}

export default memo(RecycleBinTabs)
export type { RecycleBinTabValue }
