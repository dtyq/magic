import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { ListFilter, Loader2, Menu, Plus } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { InfiniteScroll } from "antd-mobile"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { userStore } from "@/models/user"
import {
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "@/pages/superMagic/utils/superMagicCache"
import {
	SuperMobileShellRouteLayout,
	useSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { crewService, type MyCrewView } from "@/services/crew/CrewService"
import MyCrewAddSheet from "./components/MyCrewAddSheet"
import MyCrewCardMobile from "./components/MyCrewCardMobile"
import MyCrewDetailSheet from "./components/MyCrewDetailSheet"
import MyCrewFilterSheet from "./components/MyCrewFilterSheet"
import {
	countActiveMyCrewFilters,
	MY_CREW_MOBILE_FILTER_DEFAULT,
	resolveFilterScope,
	type MyCrewMobileFilterState,
} from "./components/my-crew-mobile-shared"
import { MyCrewMobileStore } from "./stores/my-crew-mobile"

/**
 * Mobile My Crew page panel.
 * Uses MyCrewMobileStore (unified API) instead of MyCrewStore (3 separate endpoints).
 * Tabs removed — FilterSheet handles scope + sort selection.
 */
function MyCrewPageMobilePanelBase() {
	const { t } = useTranslation("crew/market")
	const { openSidebar } = useSuperMobileShellOutlet()
	const navigate = useNavigate()
	const storeRef = useRef(new MyCrewMobileStore())
	const store = storeRef.current
	const scrollContainerId = useId()
	const [selectedAgent, setSelectedAgent] = useState<MyCrewView | null>(null)
	const [addSheetOpen, setAddSheetOpen] = useState(false)
	const [filterSheetOpen, setFilterSheetOpen] = useState(false)
	const [filter, setFilter] = useState<MyCrewMobileFilterState>(MY_CREW_MOBILE_FILTER_DEFAULT)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(true)

	const isPersonalOrganization = userStore.user.isPersonalOrganization
	const { isAllowed: canCreateAgent } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentCreate,
	)
	const { confirm, dialog } = useConfirmDialog()

	const visibleList = store.list
	const loading = store.loading
	const hasMore = store.hasMore
	const activeFilterCount = countActiveMyCrewFilters(filter)

	// Initial data fetch
	useEffect(() => {
		void store.fetchAgents()
		return () => store.reset()
	}, [store])

	// Scroll mask update for visual depth cues
	const updateMasks = useCallback(() => {
		const scrollElement = document.getElementById(scrollContainerId)
		if (!scrollElement) return
		setShowTopMask(scrollElement.scrollTop > 4)
		setShowBottomMask(
			scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 4,
		)
	}, [scrollContainerId])

	useEffect(() => {
		const scrollElement = document.getElementById(scrollContainerId)
		if (!scrollElement) return

		updateMasks()
		scrollElement.addEventListener("scroll", updateMasks, { passive: true })
		return () => scrollElement.removeEventListener("scroll", updateMasks)
	}, [visibleList.length, loading, scrollContainerId, updateMasks])

	/** Resolve fallback workspace ID for chat navigation. */
	function resolveFallbackWorkspaceId() {
		const userInfo = userStore.user.userInfo
		const cachedWorkspaceState = WorkspaceStateCache.get(userInfo)
		return cachedWorkspaceState.workspaceId || UserWorkspaceMapCache.get(userInfo)
	}

	const handleOpenConversation = useCallback(
		async (agentCode: string) => {
			await crewService.pinFeaturedFrequentForConversation(agentCode)
			const fallbackWorkspaceId = resolveFallbackWorkspaceId()
			navigate({
				name: fallbackWorkspaceId ? RouteName.SuperWorkspaceState : RouteName.Super,
				params: fallbackWorkspaceId ? { workspaceId: fallbackWorkspaceId } : undefined,
				query: { agentCode },
			})
		},
		[navigate],
	)

	const handleOpenCrewMarket = useCallback(() => {
		navigate({ name: RouteName.CrewMarket })
	}, [navigate])

	/** Card tap opens detail sheet. */
	const handleOpenDetails = useCallback(
		(agentCode: string) => {
			const target = store.list.find((item) => item.agentCode === agentCode)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
	)

	/** FilterSheet onChange: update local filter state and re-fetch from store. */
	const handleFilterChange = useCallback(
		(nextFilter: MyCrewMobileFilterState) => {
			setFilter(nextFilter)
			const scope = resolveFilterScope(nextFilter.type)
			void store.fetchAgents({ scope, sort: nextFilter.sort })
		},
		[store],
	)

	/** Pull-to-refresh handler passed to MagicPullToRefresh. */
	const handleRefresh = useCallback(async () => {
		await store.refresh()
	}, [store])

	/** InfiniteScroll loadMore — returns Promise<void>. */
	const handleLoadMore = useCallback(async () => {
		await store.loadMore()
	}, [store])

	/** Dismiss a market-installed agent with confirmation dialog. */
	const handleDismissAgent = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((item) => item.agentCode === agentCode)
			if (!employee) return
			const displayName = employee.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.dismissConfirm.title", { name: displayName }),
				description: t("myCrewPage.dismissConfirm.description"),
				confirmText: t("myCrewPage.dismissConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => {
					void store.dismissAgent(agentCode)
					setSelectedAgent(null)
				},
			})
		},
		[confirm, store, t],
	)

	/** Build detail sheet actions based on the selected agent's scope. */
	const detailSheetActions = useMemo(() => {
		if (!selectedAgent) return {}
		// Market-installed agents get a "Dismiss" secondary action alongside "Chat"
		if (selectedAgent.scope === "market_installed" && selectedAgent.allowDelete) {
			return {
				secondaryAction: {
					label: t("myCrewPage.dismissConfirm.confirm"),
					onClick: () => handleDismissAgent(selectedAgent.agentCode),
					testId: "my-crew-detail-sheet-dismiss-button",
				},
			}
		}
		return {}
	}, [selectedAgent, handleDismissAgent, t])

	// Whether the current filter matches defaults — used for empty-state create button visibility
	const isDefaultFilter =
		filter.type === MY_CREW_MOBILE_FILTER_DEFAULT.type &&
		filter.sort === MY_CREW_MOBILE_FILTER_DEFAULT.sort

	return (
		<>
			{dialog}
			<MyCrewDetailSheet
				employee={selectedAgent}
				open={selectedAgent != null}
				onOpenChange={(open) => {
					if (!open) setSelectedAgent(null)
				}}
				onChat={handleOpenConversation}
				{...detailSheetActions}
			/>
			<MyCrewAddSheet
				open={addSheetOpen}
				onOpenChange={setAddSheetOpen}
				onOpenMarket={handleOpenCrewMarket}
			/>
			<MyCrewFilterSheet
				open={filterSheetOpen}
				onOpenChange={setFilterSheetOpen}
				filter={filter}
				onChange={handleFilterChange}
				includeTeamShared={!isPersonalOrganization}
			/>

			<div className="flex h-full flex-col" data-testid="my-crew-page-mobile">
				{/* Top bar: menu + title + filter/add buttons */}
				<div
					className="relative z-10 flex h-14 shrink-0 items-center gap-2 px-[10px]"
					data-testid="my-crew-mobile-top-bar"
				>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={openSidebar}
						className="h-12 w-12 shrink-0 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("super:mobile.shell.menuAria")}
						data-testid="my-crew-menu-button"
					>
						<Menu className="h-[22px] w-[22px] text-foreground" strokeWidth={2} />
					</Button>

					<p
						className="pointer-events-none absolute inset-x-0 truncate px-[124px] text-center font-poppins text-[18px] font-medium leading-6 text-foreground"
						data-testid="my-crew-title"
					>
						{t("myCrewPage.title")}
					</p>

					{/* 右：胶囊按钮组（Plus + ListFilter），共用一个圆角容器 */}
					<div
						className="z-10 ml-auto flex h-12 shrink-0 items-stretch overflow-hidden rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						data-testid="my-crew-header-capsule"
					>
						{canCreateAgent ? (
							<button
								type="button"
								onClick={() => setAddSheetOpen(true)}
								className="flex h-12 w-12 shrink-0 items-center justify-center active:opacity-70"
								aria-label={t("createCrew")}
								data-testid="my-crew-create-button"
							>
								<Plus
									className="h-[22px] w-[22px] text-foreground"
									strokeWidth={2}
								/>
							</button>
						) : null}
						<button
							type="button"
							onClick={() => setFilterSheetOpen(true)}
							className="flex h-12 w-12 shrink-0 items-center justify-center active:opacity-70"
							aria-label={t("myCrewPage.filterSheet.title")}
							data-testid="my-crew-filter-button"
						>
							<div className="relative">
								<ListFilter
									className="h-[22px] w-[22px] text-foreground"
									strokeWidth={2}
								/>
								{activeFilterCount > 0 ? (
									<span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-[3px] text-[10px] font-bold leading-none text-primary-foreground">
										{activeFilterCount}
									</span>
								) : null}
							</div>
						</button>
					</div>
				</div>

				{/* Scrollable content area with pull-to-refresh + infinite scroll */}
				<div className="relative min-h-0 flex-1">
					<div
						id={scrollContainerId}
						className="no-scrollbar absolute inset-0 overflow-y-auto"
						data-testid="my-crew-scroll-container"
					>
						<MagicPullToRefresh
							onRefresh={handleRefresh}
							containerClassName="relative min-h-0 flex-1"
							showSuccessMessage={false}
						>
							<div className="flex min-h-full flex-col px-3 pb-4 pt-4">
								{/* Loading spinner */}
								{loading ? (
									<div
										className="flex items-center justify-center py-16"
										data-testid="my-crew-loading"
									>
										<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
									</div>
								) : null}

								{/* Empty state */}
								{!loading && visibleList.length === 0 ? (
									<div
										className="flex flex-col items-center justify-center gap-3 py-16 text-center"
										data-testid="my-crew-empty"
									>
										<p className="text-sm text-muted-foreground">
											{t("myCrewPage.empty")}
										</p>
										{isDefaultFilter && canCreateAgent ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => setAddSheetOpen(true)}
												className="gap-2"
												data-testid="my-crew-empty-create-button"
											>
												<Plus className="h-4 w-4" />
												{t("createCrew")}
											</Button>
										) : null}
									</div>
								) : null}

								{/* Card grid */}
								{!loading && visibleList.length > 0 ? (
									<div
										className="grid grid-cols-2 gap-3"
										data-testid="my-crew-card-grid"
									>
										{visibleList.map((employee) => (
											<MyCrewCardMobile
												key={employee.id}
												employee={employee}
												onCardClick={handleOpenDetails}
												onChat={handleOpenConversation}
											/>
										))}
									</div>
								) : null}

								{/* InfiniteScroll at the bottom of the list */}
								{!loading && visibleList.length > 0 ? (
									<InfiniteScroll hasMore={hasMore} loadMore={handleLoadMore} />
								) : null}
							</div>
						</MagicPullToRefresh>
					</div>

					{/* Top/bottom scroll masks for visual depth */}
					<div
						className="pointer-events-none absolute left-0 right-0 top-0 h-10 transition-opacity duration-200"
						style={{
							background:
								"linear-gradient(to bottom, var(--background) 0%, transparent 100%)",
							opacity: showTopMask ? 1 : 0,
						}}
					/>
					<div
						className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200"
						style={{
							background:
								"linear-gradient(to top, var(--background) 0%, transparent 100%)",
							opacity: showBottomMask ? 1 : 0,
						}}
					/>
				</div>
			</div>
		</>
	)
}

const MyCrewPageMobilePanel = observer(MyCrewPageMobilePanelBase)

/** Page entry wraps the panel in the unified mobile shell layout. */
export default function MyCrewPageMobile() {
	const { t } = useTranslation("super")

	return (
		<SuperMobileShellRouteLayout
			activeView="myCrew"
			closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
			testIdPrefix="my-crew-shell"
		>
			<MyCrewPageMobilePanel />
		</SuperMobileShellRouteLayout>
	)
}
