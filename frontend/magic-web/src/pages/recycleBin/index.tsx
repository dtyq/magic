"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Separator } from "@/components/shadcn-ui/separator"
import { RecycleBinContent, RecycleBinSidebar } from "./components"

function RecycleBinPage() {
	const { t } = useTranslation("super")
	const [activeTabId, setActiveTabId] = useState(RECYCLE_BIN_TABS[0]?.id ?? "all")
	const [tabCounts, setTabCounts] = useState<Record<string, number>>({})

	const tabs = useMemo(() => {
		return RECYCLE_BIN_TABS.map((tab) => ({
			...tab,
			count: tabCounts[tab.id] ?? 0,
		}))
	}, [tabCounts])

	const activeTab = useMemo(() => {
		const found = tabs.find((tab) => tab.id === activeTabId)
		return found ?? tabs[0]
	}, [activeTabId, tabs])

	function handleTabCountChange(tabId: string, count: number) {
		setTabCounts((prev) => ({
			...prev,
			[tabId]: count,
		}))
	}

	return (
		<div
			className="flex h-full w-full flex-col gap-3.5 rounded-[10px] border border-border bg-background p-3.5"
			data-testid="recycle-bin-page"
		>
			{/* Header */}
			<div className="flex w-full flex-col gap-3">
				<div className="flex w-full items-center gap-2">
					<h1 className="text-2xl font-medium leading-normal text-foreground">
						{t("recycleBin.title")}
					</h1>
				</div>
				<Separator orientation="horizontal" />
			</div>

			{/* Main content: sidebar + content area */}
			<div className="flex min-h-0 flex-1 flex-row gap-2.5">
				<RecycleBinSidebar
					tabs={tabs}
					activeTabId={activeTabId}
					onTabChange={setActiveTabId}
				/>
				<RecycleBinContent activeTab={activeTab} onTabCountChange={handleTabCountChange} />
			</div>
		</div>
	)
}

export default RecycleBinPage

const RECYCLE_BIN_TABS: RecycleBinTab[] = [
	{ id: "all", labelKey: "recycleBin.tabs.all", count: 0 },
	{ id: "workspaces", labelKey: "recycleBin.tabs.workspaces", count: 0 },
	{ id: "projects", labelKey: "recycleBin.tabs.projects", count: 0 },
	{ id: "topics", labelKey: "recycleBin.tabs.topics", count: 0 },
	// { id: "files", labelKey: "recycleBin.tabs.files", count: 0 },
]

interface RecycleBinTab {
	id: string
	labelKey: string
	count: number
}
