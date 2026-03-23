import { baseHistory } from "@/routes/history"

type RecycleBinTabVariant = "pc" | "mobile"
const RECYCLE_BIN_TAB_QUERY_KEY = "recycleTab"

const RECYCLE_BIN_TABS_CONFIG = [
	{
		id: "all",
		labelKey: {
			pc: "recycleBin.tabs.all",
			mobile: "mobile.recycleBin.tabs.all",
		},
	},
	{
		id: "workspaces",
		labelKey: {
			pc: "recycleBin.tabs.workspaces",
			mobile: "mobile.recycleBin.tabs.workspaces",
		},
	},
	{
		id: "projects",
		labelKey: {
			pc: "recycleBin.tabs.projects",
			mobile: "mobile.recycleBin.tabs.projects",
		},
	},
	{
		id: "topics",
		labelKey: {
			pc: "recycleBin.tabs.topics",
			mobile: "mobile.recycleBin.tabs.topics",
		},
	},
	// {
	// 	id: "files",
	// 	labelKey: {
	// 		pc: "recycleBin.tabs.files",
	// 		mobile: "mobile.recycleBin.tabs.files",
	// 	},
	// },
] as const

type RecycleBinTabId = (typeof RECYCLE_BIN_TABS_CONFIG)[number]["id"]

interface RecycleBinTab {
	id: RecycleBinTabId
	labelKey: string
	count: number
}

function isRecycleBinTabId(tabId: string): tabId is RecycleBinTabId {
	return RECYCLE_BIN_TABS_CONFIG.some((tab) => tab.id === tabId)
}

function getRecycleBinTabIdFromSearchParams(searchParams: URLSearchParams): RecycleBinTabId | null {
	const tabFromQuery = searchParams.get(RECYCLE_BIN_TAB_QUERY_KEY)
	if (tabFromQuery && isRecycleBinTabId(tabFromQuery)) return tabFromQuery
	return null
}

function getRecycleBinTabIdFromQuery(): RecycleBinTabId | null {
	if (typeof window === "undefined") return null

	const params = new URLSearchParams(window.location.search)
	return getRecycleBinTabIdFromSearchParams(params)
}

function setRecycleBinTabQuery(tabId: RecycleBinTabId) {
	if (typeof window === "undefined") return
	const url = new URL(window.location.href)
	const currentTab = url.searchParams.get(RECYCLE_BIN_TAB_QUERY_KEY)
	if (currentTab === tabId) return

	url.searchParams.set(RECYCLE_BIN_TAB_QUERY_KEY, tabId)

	baseHistory.replace({
		pathname: url.pathname,
		search: url.search,
		hash: url.hash,
	})
}

function createRecycleBinTabCounts(): Record<RecycleBinTabId, number> {
	return RECYCLE_BIN_TABS_CONFIG.reduce(
		(acc, tab) => {
			acc[tab.id] = 0
			return acc
		},
		{} as Record<RecycleBinTabId, number>,
	)
}

function getRecycleBinTabs(props: {
	counts: Record<string, number>
	variant: RecycleBinTabVariant
}): RecycleBinTab[] {
	const { counts, variant } = props
	return RECYCLE_BIN_TABS_CONFIG.map((tab) => ({
		id: tab.id,
		labelKey: tab.labelKey[variant],
		count: counts[tab.id] ?? 0,
	}))
}

export {
	RECYCLE_BIN_TABS_CONFIG,
	createRecycleBinTabCounts,
	getRecycleBinTabs,
	getRecycleBinTabIdFromQuery,
	getRecycleBinTabIdFromSearchParams,
	isRecycleBinTabId,
	setRecycleBinTabQuery,
}
export type { RecycleBinTab, RecycleBinTabId, RecycleBinTabVariant }
