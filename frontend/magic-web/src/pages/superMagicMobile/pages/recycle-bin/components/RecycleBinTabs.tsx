import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"

import tabsActiveIndicator from "../assets/svg/tabs-active-indicator.svg"

type RecycleBinTabValue = "all" | "workspaces" | "projects" | "topics" | "files"

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
			className="w-full shrink-0 rounded-b-[14px] bg-background p-2 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
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
					<RecycleBinTabTrigger
						value="all"
						label={t("mobile.recycleBin.tabs.all", { count: tabCounts.all ?? 0 })}
					/>
					<RecycleBinTabTrigger
						value="workspaces"
						label={t("mobile.recycleBin.tabs.workspaces", {
							count: tabCounts.workspaces ?? 0,
						})}
					/>
					<RecycleBinTabTrigger
						value="projects"
						label={t("mobile.recycleBin.tabs.projects", {
							count: tabCounts.projects ?? 0,
						})}
					/>
					<RecycleBinTabTrigger
						value="topics"
						label={t("mobile.recycleBin.tabs.topics", {
							count: tabCounts.topics ?? 0,
						})}
					/>
					{/* <RecycleBinTabTrigger
						value="files"
						label={t("mobile.recycleBin.tabs.files", { count: tabCounts.files ?? 0 })}
					/> */}
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
