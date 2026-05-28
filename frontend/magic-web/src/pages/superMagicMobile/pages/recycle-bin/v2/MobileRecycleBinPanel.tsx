import { memo, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { useSuperMobileShellOutlet } from "@/pages/superMagicMobile/components/MobileShell"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { useRecycleBinTabSearchParamsSync } from "@/pages/recycleBin/hooks/useRecycleBinTabSearchParamsSync"
import {
	RECYCLE_BIN_TABS_CONFIG,
	createRecycleBinTabCounts,
	getRecycleBinTabIdFromSearchParams,
	setRecycleBinTabQuery,
	type RecycleBinTabId,
} from "@/pages/recycleBin/tab-config"

import RecycleBinContent from "./components/RecycleBinContent"
import RecycleBinHeader from "./components/RecycleBinHeader"

const INITIAL_TAB_COUNTS = createRecycleBinTabCounts()

function MobileRecycleBinPanel() {
	const { openSidebar } = useSuperMobileShellOutlet()
	const [searchParams] = useSearchParams()
	const { t } = useTranslation("super")

	const [activeTab, setActiveTab] = useState<RecycleBinTabId>(() => {
		return getRecycleBinTabIdFromSearchParams(searchParams) ?? "all"
	})
	const [searchValue, setSearchValue] = useState("")
	const [tabCounts, setTabCounts] = useState<Record<string, number>>(INITIAL_TAB_COUNTS)
	const [filterSheetOpen, setFilterSheetOpen] = useState(false)
	const [order, setOrder] = useState<"desc" | "asc">("desc")
	const [hasSelection, setHasSelection] = useState(false)
	// 每次下拉刷新时自增，传入 RecycleBinContent 触发重新加载第 1 页
	const [refreshSignal, setRefreshSignal] = useState(0)

	const scrollRef = useRef<HTMLDivElement>(null)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(true)

	const handleRefresh = useCallback(async () => {
		setRefreshSignal((prev) => prev + 1)
	}, [])

	const updateMasks = useCallback(() => {
		const el = scrollRef.current
		if (!el) return
		setShowTopMask(el.scrollTop > 4)
		setShowBottomMask(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
	}, [])

	useEffect(() => {
		updateMasks()
	}, [updateMasks, tabCounts, searchValue, hasSelection])

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
			<RecycleBinHeader
				onMenuClick={openSidebar}
				onFilterClick={() => setFilterSheetOpen(true)}
			/>

			{/* 与原型 TrashScreen 一致：列表区无顶部大圆角「卡片」，整页统一 background */}
			<div
				id="mobile-recycle-bin-scroll-container"
				ref={scrollRef}
				onScroll={updateMasks}
				className="relative min-h-0 flex-1 overflow-y-auto"
			>
				{/* 对齐对话页的单层滚动结构，让下拉提示与顶部壳层保持稳定间距。 */}
				<MagicPullToRefresh
					onRefresh={handleRefresh}
					showSuccessMessage={false}
					containerClassName="relative min-h-0 flex-1"
				>
					<div className="min-h-full px-3 pb-4 pt-2">
						<RecycleBinContent
							activeTab={activeTab}
							searchValue={searchValue}
							order={order}
							onTabCountChange={handleTabCountChange}
							onSelectionStateChange={setHasSelection}
							refreshSignal={refreshSignal}
						/>
					</div>
				</MagicPullToRefresh>

				<div
					className="pointer-events-none absolute left-0 right-0 top-0 h-8 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to bottom, var(--mobile-background) 0%, transparent 100%)",
						opacity: showTopMask ? 1 : 0,
					}}
				/>
				<div
					className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 transition-opacity duration-200"
					style={{
						background:
							"linear-gradient(to top, var(--mobile-background) 0%, transparent 100%)",
						opacity: showBottomMask ? 1 : 0,
					}}
				/>
			</div>

			{/* 多选底栏通过 Portal 挂载到流式底部，避免 fixed 压到 Home Indicator 区域 */}
			<div
				id="mobile-recycle-bin-selection-mount"
				className="shrink-0"
				data-testid="mobile-recycle-bin-selection-mount"
			/>

			{/* 对齐原型 BottomSearchBar + FloatingSearchBar：流式底栏、全圆角输入条、独立清除按钮 */}
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
				}}
				className="flex h-[90dvh] flex-col gap-0 overflow-hidden rounded-t-[20px] border-0 bg-muted p-0"
				bodyClassName="flex-1 overflow-y-auto bg-muted px-4 py-4"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
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
									{t(tab.labelKey.mobile, {
										count: tabCounts[tab.id] ?? 0,
									})}
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
					>
						<span className="text-[16px] text-foreground">
							{t("mobile.recycleBin.filterSheet.oldToNew")}
						</span>
						{order === "asc" && (
							<Check className="size-[20px] text-foreground" strokeWidth={3} />
						)}
					</button>
				</div>
			</MagicPopup>
		</div>
	)
}

export default memo(MobileRecycleBinPanel)
