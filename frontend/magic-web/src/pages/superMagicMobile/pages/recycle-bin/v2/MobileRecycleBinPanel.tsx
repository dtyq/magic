import { memo, useCallback, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { useRecycleBinTabSearchParamsSync } from "@/pages/recycleBin/hooks/useRecycleBinTabSearchParamsSync"
import {
	RECYCLE_BIN_TABS_CONFIG,
	createRecycleBinTabCounts,
	getRecycleBinTabIdFromSearchParams,
	setRecycleBinTabQuery,
	type RecycleBinTabId,
	useRecycleBinTabLabel,
} from "@/pages/recycleBin/tab-config"

import RecycleBinContent from "./components/RecycleBinContent"
import RecycleBinHeader from "./components/RecycleBinHeader"

const INITIAL_TAB_COUNTS = createRecycleBinTabCounts()

function MobileRecycleBinPanel() {
	const [searchParams] = useSearchParams()
	const { t } = useTranslation("super")
	const getTabLabel = useRecycleBinTabLabel("mobile")

	const [activeTab, setActiveTab] = useState<RecycleBinTabId>(() => {
		return getRecycleBinTabIdFromSearchParams(searchParams) ?? "all"
	})
	const [searchValue, setSearchValue] = useState("")
	const [tabCounts, setTabCounts] = useState<Record<string, number>>(INITIAL_TAB_COUNTS)
	const [filterSheetOpen, setFilterSheetOpen] = useState(false)
	const [order, setOrder] = useState<"desc" | "asc">("desc")
	const [hasSelection, setHasSelection] = useState(false)
	const [shouldStretchPullToRefresh, setShouldStretchPullToRefresh] = useState(false)
	// Increment on refresh so RecycleBinContent reloads the first page.
	const [refreshSignal, setRefreshSignal] = useState(0)

	/*
	 * Stretch the pull-to-refresh height chain only for empty states.
	 * Preserve the populated list structure for pagination and pull-to-refresh gestures.
	 */
	const pullToRefreshStretchClassName =
		"[&_.adm-pull-to-refresh]:flex [&_.adm-pull-to-refresh]:h-full [&_.adm-pull-to-refresh]:min-h-0 [&_.adm-pull-to-refresh]:flex-col [&_.adm-pull-to-refresh-content]:flex [&_.adm-pull-to-refresh-content]:min-h-0 [&_.adm-pull-to-refresh-content]:flex-1 [&_.adm-pull-to-refresh-content]:flex-col"

	const handleRefresh = useCallback(async () => {
		setRefreshSignal((prev) => prev + 1)
	}, [])

	const handleTabCountChange = useCallback((tabId: string, count: number) => {
		setTabCounts((prev) => ({ ...prev, [tabId]: count }))
	}, [])

	useRecycleBinTabSearchParamsSync({
		onTabIdChange: setActiveTab,
	})

	function handleTabChange(value: RecycleBinTabId) {
		setActiveTab(value)
		setRecycleBinTabQuery(value)
	}

	return (
		<div
			className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-mobile-background"
			data-testid="mobile-recycle-bin-page"
		>
			<RecycleBinHeader onFilterClick={() => setFilterSheetOpen(true)} />

			{/* Use the page background without a rounded card around the list. */}
			<ScrollEdgeFadeContainer
				fadeColor="mobile-background"
				className="min-h-0 flex-1"
				contentDeps={[
					tabCounts,
					searchValue,
					activeTab,
					order,
					hasSelection,
					refreshSignal,
					shouldStretchPullToRefresh,
				]}
			>
				{/* Keep one scrolling layer so the refresh hint stays aligned with the page header. */}
				<MagicPullToRefresh
					embedInParentScroll
					onRefresh={handleRefresh}
					showSuccessMessage={false}
					containerClassName={cn(
						"relative min-h-0 flex-1",
						shouldStretchPullToRefresh &&
							cn("!overflow-hidden", pullToRefreshStretchClassName),
					)}
				>
					<div className="min-h-full px-3 pb-4 pt-2">
						<RecycleBinContent
							activeTab={activeTab}
							searchValue={searchValue}
							order={order}
							onTabCountChange={handleTabCountChange}
							onSelectionStateChange={setHasSelection}
							onEmptyStateChange={setShouldStretchPullToRefresh}
							refreshSignal={refreshSignal}
						/>
					</div>
				</MagicPullToRefresh>
			</ScrollEdgeFadeContainer>

			{/* Mount selection actions in the flowing footer to avoid covering the home indicator. */}
			<div
				id="mobile-recycle-bin-selection-mount"
				className="shrink-0"
				data-testid="mobile-recycle-bin-selection-mount"
			/>

			{/* Keep the search bar in the footer with its own clear button. */}
			{!hasSelection ? (
				<MobileBottomSearchBar
					value={searchValue}
					placeholder={t("mobile.recycleBin.search.placeholder")}
					clearAriaLabel={t("mobile.recycleBin.search.cancel")}
					onValueChange={setSearchValue}
					clearButtonVisibility="focus-or-value"
					testIdPrefix="mobile-recycle-bin-bottom-search"
				/>
			) : null}

			<MagicPopup
				visible={filterSheetOpen}
				onOpenChange={setFilterSheetOpen}
				onClose={() => setFilterSheetOpen(false)}
				position="bottom"
				title={t("mobile.recycleBin.filterSheet.title")}
				headerVariant="actionHeader"
				headerTitle={t("mobile.recycleBin.filterSheet.title")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.close"),
					onClick: () => setFilterSheetOpen(false),
					testId: "mobile-recycle-bin-filter-sheet-close",
				}}
				// Clip ancestors so focusing a filter cannot scroll the fixed action header away.
				className="flex h-[90vh] flex-col gap-0 overflow-hidden rounded-t-[20px] border-0 bg-muted p-0 supports-[height:100dvh]:h-[90dvh] supports-[overflow:clip]:overflow-clip"
				bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted p-0 supports-[overflow:clip]:overflow-clip"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			>
				{/* Filter options scroll while the shared action header stays fixed. */}
				<ScrollArea
					className="grid min-h-0 flex-1"
					viewportClassName="h-auto min-h-0 px-4 py-4 [&>div]:!block"
				>
					<div className="mb-2 ml-1 text-[13px] text-muted-foreground">
						{t("mobile.recycleBin.filterSheet.category")}
					</div>
					<div
						className="flex flex-col overflow-hidden rounded-[14px] bg-card"
						data-testid="mobile-recycle-bin-filter-sheet-tabs"
					>
						{RECYCLE_BIN_TABS_CONFIG.map((tab, index) => (
							<div key={tab.id}>
								{index > 0 ? (
									<div className="ml-4 h-px w-[calc(100%-1rem)] bg-border/50" />
								) : null}
								<button
									type="button"
									onClick={() => handleTabChange(tab.id)}
									className="flex h-[52px] w-full items-center justify-between bg-card px-4 active:bg-muted/50"
									data-testid={`mobile-recycle-bin-tab-${tab.id}`}
								>
									<span className="text-left text-[16px] text-foreground">
										{getTabLabel(tab.id, tabCounts[tab.id] ?? 0)}
									</span>
									{activeTab === tab.id ? (
										<Check
											className="size-[20px] text-foreground"
											strokeWidth={3}
										/>
									) : null}
								</button>
							</div>
						))}
					</div>

					<div className="mb-2 ml-1 mt-6 text-[13px] text-muted-foreground">
						{t("mobile.recycleBin.filterSheet.order")}
					</div>
					<div className="flex flex-col overflow-hidden rounded-[14px] bg-card">
						<button
							type="button"
							onClick={() => setOrder("desc")}
							className="flex h-[52px] items-center justify-between bg-card px-4 active:bg-muted/50"
							data-testid="set-order"
						>
							<span className="text-[16px] text-foreground">
								{t("mobile.recycleBin.filterSheet.newToOld")}
							</span>
							{order === "desc" && (
								<Check className="size-[20px] text-foreground" strokeWidth={3} />
							)}
						</button>
						<div className="ml-4 h-[1px] w-full bg-border/50" />
						<button
							type="button"
							onClick={() => setOrder("asc")}
							className="flex h-[52px] items-center justify-between bg-card px-4 active:bg-muted/50"
							data-testid="set-order-2"
						>
							<span className="text-[16px] text-foreground">
								{t("mobile.recycleBin.filterSheet.oldToNew")}
							</span>
							{order === "asc" && (
								<Check className="size-[20px] text-foreground" strokeWidth={3} />
							)}
						</button>
					</div>
				</ScrollArea>
			</MagicPopup>
		</div>
	)
}

export default memo(MobileRecycleBinPanel)
