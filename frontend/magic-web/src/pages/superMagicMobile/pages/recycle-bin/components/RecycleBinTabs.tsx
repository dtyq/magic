import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import { RECYCLE_BIN_TABS_CONFIG, type RecycleBinTabId } from "@/pages/recycleBin/tab-config"

import tabsActiveIndicator from "../assets/svg/tabs-active-indicator.svg"
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
		<div
			className="w-full shrink-0 rounded-b-2xl bg-background p-2 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
			data-testid="mobile-recycle-bin-filter"
		>
			<Tabs
				value={activeTab}
				onValueChange={(value) => onTabChange(value as RecycleBinTabValue)}
				className="w-full"
				data-testid="mobile-recycle-bin-tabs"
			>
				<TabsList
					className="no-scrollbar h-auto w-full justify-start gap-2 overflow-x-auto bg-background p-1"
					data-testid="mobile-recycle-bin-tabs-list"
				>
					{RECYCLE_BIN_TABS_CONFIG.map((tab) => (
						<RecycleBinTabTrigger
							key={tab.id}
							value={tab.id}
							label={t(tab.labelKey.mobile, { count: tabCounts[tab.id] ?? 0 })}
						/>
					))}
				</TabsList>
			</Tabs>
		</div>
	)
}

function RecycleBinTabTrigger(props: { value: RecycleBinTabValue; label: string }) {
	const { value, label } = props

	return (
		<TabsTrigger
			value={value}
			className="group relative h-auto flex-none rounded-lg px-3 py-1 text-sm font-medium leading-5 text-foreground data-[state=active]:bg-background data-[state=active]:shadow-none"
			data-testid={`mobile-recycle-bin-tab-${value}`}
		>
			<span className="whitespace-nowrap">{label}</span>
			<img
				alt=""
				aria-hidden
				src={tabsActiveIndicator}
				className="absolute bottom-0 left-1/2 hidden h-[2px] w-[43px] -translate-x-1/2 group-data-[state=active]:block"
			/>
		</TabsTrigger>
	)
}

export default memo(RecycleBinTabs)
export type { RecycleBinTabValue }
