import { memo, useState, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"

import RecycleBinHeader from "./components/RecycleBinHeader"
import RecycleBinTabs, { type RecycleBinTabValue } from "./components/RecycleBinTabs"
import RecycleBinContent from "./components/RecycleBinContent"
import { useRecycleBinTabSearchParamsSync } from "../../../recycleBin/hooks/useRecycleBinTabSearchParamsSync"
import {
	createRecycleBinTabCounts,
	getRecycleBinTabIdFromSearchParams,
	setRecycleBinTabQuery,
} from "@/pages/recycleBin/tab-config"

const INITIAL_TAB_COUNTS = createRecycleBinTabCounts()

function MobileRecycleBinPage() {
	const navigate = useNavigate({
		fallbackRoute: { name: RouteName.MobileTabs },
	})
	const [searchParams] = useSearchParams()

	const [activeTab, setActiveTab] = useState<RecycleBinTabValue>(() => {
		return getRecycleBinTabIdFromSearchParams(searchParams) ?? "all"
	})
	const [isSearchOpen, setIsSearchOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [tabCounts, setTabCounts] = useState<Record<string, number>>(INITIAL_TAB_COUNTS)

	const handleTabCountChange = useCallback((tabId: string, count: number) => {
		setTabCounts((prev) => ({ ...prev, [tabId]: count }))
	}, [])

	function handleBackClick() {
		navigate({
			delta: -1,
			viewTransition: {
				direction: "right",
			},
		})
	}

	function handleSearchOpen() {
		setIsSearchOpen(true)
	}

	function handleSearchCancel() {
		setIsSearchOpen(false)
		setSearchValue("")
	}

	function handleSearchValueChange(value: string) {
		setSearchValue(value)
	}

	function handleTabChange(value: RecycleBinTabValue) {
		setActiveTab(value)
		setRecycleBinTabQuery(value)
	}

	useRecycleBinTabSearchParamsSync({
		onTabIdChange: setActiveTab,
	})

	return (
		<div
			className="flex h-full w-full flex-col bg-background"
			data-testid="mobile-recycle-bin-page"
		>
			<RecycleBinHeader
				isSearchOpen={isSearchOpen}
				searchValue={searchValue}
				onBackClick={handleBackClick}
				onSearchOpen={handleSearchOpen}
				onSearchCancel={handleSearchCancel}
				onSearchValueChange={handleSearchValueChange}
			/>

			<RecycleBinTabs
				activeTab={activeTab}
				onTabChange={handleTabChange}
				tabCounts={tabCounts}
			/>

			<RecycleBinContent
				activeTab={activeTab}
				searchValue={searchValue}
				onTabCountChange={handleTabCountChange}
			/>
		</div>
	)
}

export default memo(MobileRecycleBinPage)
