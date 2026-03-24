"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Separator } from "@/components/shadcn-ui/separator"
import { RecycleBinContent, RecycleBinSidebar } from "./components"
import { useRecycleBinTabSearchParamsSync } from "./hooks/useRecycleBinTabSearchParamsSync"
import {
	RECYCLE_BIN_TABS_CONFIG,
	getRecycleBinTabs,
	getRecycleBinTabIdFromSearchParams,
	isRecycleBinTabId,
	setRecycleBinTabQuery,
	type RecycleBinTab,
	type RecycleBinTabId,
} from "./tab-config"

function RecycleBinPage() {
	const { t } = useTranslation("super")
	const [searchParams] = useSearchParams()
	const [activeTabId, setActiveTabId] = useState<RecycleBinTabId>(() => {
		return (
			getRecycleBinTabIdFromSearchParams(searchParams) ??
			RECYCLE_BIN_TABS_CONFIG[0]?.id ??
			"all"
		)
	})
	const [tabCounts, setTabCounts] = useState<Record<string, number>>({})

	const tabs = useMemo<RecycleBinTab[]>(() => {
		return getRecycleBinTabs({
			counts: tabCounts,
			variant: "pc",
		})
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

	function handleTabChange(tabId: string) {
		if (!isRecycleBinTabId(tabId)) return
		setActiveTabId(tabId)
		setRecycleBinTabQuery(tabId)
	}

	useRecycleBinTabSearchParamsSync({
		onTabIdChange: setActiveTabId,
	})

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
					onTabChange={handleTabChange}
				/>
				<RecycleBinContent activeTab={activeTab} onTabCountChange={handleTabCountChange} />
			</div>
		</div>
	)
}

export default RecycleBinPage
