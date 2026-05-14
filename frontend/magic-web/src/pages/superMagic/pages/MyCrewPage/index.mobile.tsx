import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CirclePlus, ListFilter, Loader2, Menu } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { RoutePath } from "@/constants/routes"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import PcOnlyNoticeDialog from "@/pages/superMagic/components/PcOnlyNoticeDialog"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import {
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "@/pages/superMagic/utils/superMagicCache"
import ActionsPopupComponent from "@/pages/superMagicMobile/components/ActionsPopup"
import type { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup/types"
import {
	SuperMobileShellRouteLayout,
	useSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell"
import { defaultClusterCode } from "@/routes/helpers"
import { fillRoute } from "@/routes/history/helpers"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { crewService, type MyCrewView } from "@/services/crew/CrewService"
import { ViewTransitionPresets } from "@/types/viewTransition"
import MyCrewAddSheet from "./components/MyCrewAddSheet"
import MyCrewCardMobile from "./components/MyCrewCardMobile"
import MyCrewCrewTypeTabs from "./components/MyCrewCrewTypeTabs"
import MyCrewDetailSheet from "./components/MyCrewDetailSheet"
import MyCrewFilterSheet from "./components/MyCrewFilterSheet"
import {
	resolveMyCrewDisableActionDisabled,
	resolveMyCrewDisableActionLabel,
	resolveMyCrewHiredActionKind,
	resolveTeamSharedCrewPermissions,
} from "./components/my-crew-card-shared"
import {
	countActiveMyCrewFilters,
	MY_CREW_MOBILE_FILTER_DEFAULT,
	resolveMyCrewListVariant,
	type MyCrewMobileFilterState,
} from "./components/my-crew-mobile-shared"
import { useMyCrewTabs } from "./hooks/useMyCrewTabs"
import { MyCrewStore } from "./stores/my-crew"
import type { MyCrewCrewTypeTab } from "./tab-state"

/** 页面面板只负责把移动端壳层、浮层和既有 `MyCrewStore` 数据能力接起来。 */
function MyCrewPageMobilePanelBase() {
	const { t } = useTranslation("crew/market")
	const { openSidebar } = useSuperMobileShellOutlet()
	const navigate = useNavigate()
	const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
	const storeRef = useRef(new MyCrewStore())
	const scrollContainerRef = useRef<HTMLDivElement | null>(null)
	const store = storeRef.current
	const [pcOnlyDialogOpen, setPcOnlyDialogOpen] = useState(false)
	const [selectedAgent, setSelectedAgent] = useState<MyCrewView | null>(null)
	const [selectedActionAgent, setSelectedActionAgent] = useState<MyCrewView | null>(null)
	const [addSheetOpen, setAddSheetOpen] = useState(false)
	const [filterSheetOpen, setFilterSheetOpen] = useState(false)
	const [filter, setFilter] = useState<MyCrewMobileFilterState>(MY_CREW_MOBILE_FILTER_DEFAULT)
	const [showTopMask, setShowTopMask] = useState(false)
	const [showBottomMask, setShowBottomMask] = useState(false)
	const {
		crewTypeTab,
		setCrewTypeTab,
		includeTeamShared,
		isCreatedTab,
		isHiredTab,
		isTeamSharedTab,
	} = useMyCrewTabs({ includeTeamShared: true })
	const { isAllowed: canCreateAgent } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.AgentCreate,
	)
	const { confirm, dialog } = useConfirmDialog()

	const visibleList = store.list
	const loading = store.loading
	const loadingMore = store.loadingMore
	const hasMore = store.hasMore
	const activeFilterCount = countActiveMyCrewFilters(filter)

	useEffect(() => {
		void store.fetchAgents({ listVariant: crewTypeTab })
		return () => store.reset()
	}, [crewTypeTab, store])

	useEffect(() => {
		const expectedFilterType = resolveFilterTypeFromTab(crewTypeTab)
		setFilter((previousFilter) =>
			previousFilter.type === expectedFilterType
				? previousFilter
				: { type: expectedFilterType },
		)
	}, [crewTypeTab])

	const handleAutoLoadMore = useCallback(() => {
		void store.loadMore()
	}, [store])

	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollContainerRef,
		disabled: loading || loadingMore || !hasMore,
		onLoadMore: handleAutoLoadMore,
	})
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: loadingMore,
	})

	/** 渐变遮罩只提供滚动反馈，不参与业务状态判断。 */
	const updateMasks = useCallback(() => {
		const element = scrollContainerRef.current
		if (!element) return
		setShowTopMask(element.scrollTop > 4)
		setShowBottomMask(element.scrollTop + element.clientHeight < element.scrollHeight - 4)
	}, [])

	useEffect(() => {
		const frame = requestAnimationFrame(updateMasks)
		return () => cancelAnimationFrame(frame)
	}, [loading, shouldShowLoadingMoreIndicator, updateMasks, visibleList.length])

	/** 当前移动端仍不放开真实创建/编辑，所以统一落到 PC only 提示。 */
	function showPcOnlyNotice() {
		setPcOnlyDialogOpen(true)
	}

	/** 语义化 href 仍然保留，但左键点击时在移动端只做卡片内交互，不直接跳转。 */
	function handleCrewCardNavigate(event: React.MouseEvent<HTMLAnchorElement>) {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return
		}

		event.preventDefault()
	}

	/** 移动端卡片的语义化链接维持在当前页面，避免误导成真实编辑入口。 */
	function getMyCrewPageHref() {
		return (
			fillRoute(`/:clusterCode${RoutePath.MyCrew}`, {
				clusterCode,
			}) || "#"
		)
	}

	/** 对话跳转继续沿用现有工作区兜底逻辑，不为移动端新 UI 发明新路由。 */
	function resolveFallbackWorkspaceId() {
		const userInfo = userStore.user.userInfo
		const cachedWorkspaceState = WorkspaceStateCache.get(userInfo)
		return cachedWorkspaceState.workspaceId || UserWorkspaceMapCache.get(userInfo)
	}

	/** Chat 主 CTA 仍接回现有会话链路，保证 UI 重构不覆盖生产入口。 */
	const handleOpenConversation = useCallback(
		async (agentCode: string) => {
			await crewService.pinFeaturedFrequentForConversation(agentCode)
			const fallbackWorkspaceId = resolveFallbackWorkspaceId()
			navigate({
				name: fallbackWorkspaceId ? RouteName.SuperWorkspaceState : RouteName.Super,
				params: fallbackWorkspaceId
					? {
							workspaceId: fallbackWorkspaceId,
						}
					: undefined,
				query: {
					agentCode,
				},
			})
		},
		[navigate],
	)

	/** 市场入口属于现有真实能力，保留在 Add sheet 中作为安全分流项。 */
	const handleOpenCrewMarket = useCallback(() => {
		navigate({ name: RouteName.CrewMarket })
	}, [navigate])

	/** 卡片根点击只打开详情，不再把整张卡片直接映射成编辑入口。 */
	const handleOpenDetails = useCallback(
		(agentCode: string) => {
			const target = store.list.find((item) => item.agentCode === agentCode)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
	)

	/** 编辑入口继续保留，但动作统一降级到桌面端提示。 */
	const handleEdit = useCallback((agentCode: string) => {
		void agentCode
		showPcOnlyNotice()
	}, [])

	const handleOpenActions = useCallback((employee: MyCrewView) => {
		setSelectedActionAgent(employee)
	}, [])

	const handleOpenConversation = useCallback(
		async (agentCode: string) => {
			await crewService.pinFeaturedFrequentForConversation(agentCode)
			const userInfo = userStore.user.userInfo
			const cachedWorkspaceState = WorkspaceStateCache.get(userInfo)
			const fallbackWorkspaceId =
				cachedWorkspaceState.workspaceId || UserWorkspaceMapCache.get(userInfo)
			navigate({
				name: fallbackWorkspaceId ? RouteName.SuperWorkspaceState : RouteName.Super,
				params: fallbackWorkspaceId
					? {
							workspaceId: fallbackWorkspaceId,
						}
					: undefined,
				query: {
					agentCode,
				},
			})
		},
		[navigate],
	)

	const handleBack = useCallback(() => {
		navigate({
			delta: -1,
			viewTransition: ViewTransitionPresets.slideRight,
		})
	}, [navigate])

	const handleDeleteCreatedCrew = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((item) => item.agentCode === agentCode)
			const displayName = employee?.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.deleteConfirm.title", { name: displayName }),
				description: t("myCrewPage.deleteConfirm.description"),
				confirmText: t("myCrewPage.deleteConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => {
					void store.deleteAgent(agentCode)
				},
			})
		},
		[confirm, store, t],
	)

	const handleDismissHiredCrew = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((item) => item.agentCode === agentCode)
			if (!employee?.allowDelete) return
			const displayName = employee?.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.dismissConfirm.title", { name: displayName }),
				description: t("myCrewPage.dismissConfirm.description"),
				confirmText: t("myCrewPage.dismissConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => {
					void store.deleteAgent(agentCode)
				},
			})
		},
		[confirm, store, t],
	)

	const handleDisableHiredCrew = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((item) => item.agentCode === agentCode)
			if (!employee?.enabled) return
			const displayName = employee?.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.disableConfirm.title", { name: displayName }),
				description: t("myCrewPage.disableConfirm.description"),
				confirmText: t("myCrewPage.disableConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => {
					void store.offlineAgent(agentCode)
				},
			})
		},
		[confirm, store, t],
	)

	const handleUpgrade = useCallback(
		(agentCode: string) => {
			void store.upgradeAgent(agentCode)
		},
		[store],
	)

	/** 头部 tabs 和筛选 sheet 共用同一真实列表语义，避免出现双份状态源。 */
	const handleFilterChange = useCallback(
		(nextFilter: MyCrewMobileFilterState) => {
			setFilter(nextFilter)
			setCrewTypeTab(resolveMyCrewListVariant(nextFilter.type))
		},
		[setCrewTypeTab],
	)

	const handleTabChange = useCallback(
		(nextTab: MyCrewCrewTypeTab) => {
			setCrewTypeTab(nextTab)
			setFilter({ type: resolveFilterTypeFromTab(nextTab) })
		},
		[setCrewTypeTab],
	)

	const mobileActions = useMemo<ActionsPopup.ActionButtonConfig[]>(() => {
		if (!selectedActionAgent) return []

		const actions: ActionsPopup.ActionButtonConfig[] = []
		const permissions = resolveTeamSharedCrewPermissions(selectedActionAgent.userRole)
		const isTeamSharedActionAgent = crewTypeTab === "team-shared"
		const canOpenConversation = Boolean(selectedActionAgent.latestPublishedAt?.trim())

		if (!isTeamSharedActionAgent && canOpenConversation) {
			actions.push({
				key: "conversation",
				label: t("myCrewPage.openConversation"),
				onClick: () => {
					setSelectedActionAgent(null)
					void handleOpenConversation(selectedActionAgent.agentCode)
				},
				"data-testid": "my-crew-mobile-action-conversation",
			})
		}

		if (!isTeamSharedActionAgent && selectedActionAgent.needUpgrade) {
			actions.push({
				key: "upgrade",
				label: t("skillsLibrary.upgrade"),
				onClick: () => {
					setSelectedActionAgent(null)
					handleUpgrade(selectedActionAgent.agentCode)
				},
				"data-testid": "my-crew-mobile-action-upgrade",
			})
		}

		if (isTeamSharedActionAgent && permissions.canPublish) {
			actions.push({
				key: "publish",
				label: t("myCrewPage.openPublish"),
				onClick: () => {
					setSelectedActionAgent(null)
					showPcOnlyNotice()
				},
				"data-testid": "my-crew-mobile-action-publish",
			})
		}

		if (!isTeamSharedActionAgent || permissions.canDelete) {
			actions.push({
				key: "delete",
				label: t("myCrewPage.delete"),
				variant: "danger",
				onClick: () => {
					setSelectedActionAgent(null)
					handleDeleteCreatedCrew(selectedActionAgent.agentCode)
				},
				"data-testid": "my-crew-mobile-action-delete",
			})
		}

		return actions
	}, [crewTypeTab, handleDeleteCreatedCrew, handleUpgrade, selectedActionAgent, t])

	return (
		<>
			{dialog}
			<MyCrewDetailSheet
				employee={selectedAgent}
				listVariant={crewTypeTab}
				open={selectedAgent != null}
				onOpenChange={(open) => {
					if (!open) setSelectedAgent(null)
				}}
				onChat={handleOpenConversation}
			/>
			<PcOnlyNoticeDialog
				open={pcOnlyDialogOpen}
				onOpenChange={setPcOnlyDialogOpen}
				title={t("myCrewPage.pcOnlyNotice.title")}
				description={t("myCrewPage.pcOnlyNotice.description")}
				confirmText={t("myCrewPage.pcOnlyNotice.confirm")}
				testIdPrefix="my-crew-pc-only"
			/>
			<ActionsPopupComponent
				visible={selectedActionAgent != null}
				title={t("myCrewPage.moreActionsAria")}
				actions={mobileActions}
				onClose={() => setSelectedActionAgent(null)}
			/>
			<MyCrewAddSheet
				open={addSheetOpen}
				onOpenChange={setAddSheetOpen}
				onOpenMarket={handleOpenCrewMarket}
				onCreateCustom={showPcOnlyNotice}
			/>
			<MyCrewFilterSheet
				open={filterSheetOpen}
				onOpenChange={setFilterSheetOpen}
				filter={filter}
				onChange={handleFilterChange}
				includeTeamShared={includeTeamShared}
			/>

			<div className="flex h-full flex-col" data-testid="my-crew-page-mobile">
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

					<div className="z-10 ml-auto flex shrink-0 items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setFilterSheetOpen(true)}
							className="h-12 w-12 shrink-0 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
							aria-label={t("myCrewPage.filterSheet.title")}
							data-testid="my-crew-filter-button"
						>
							<div className="relative">
								<ListFilter
									className="h-[20px] w-[20px] text-foreground"
									strokeWidth={2}
								/>
								{activeFilterCount > 0 ? (
									<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
										{activeFilterCount}
									</span>
								) : null}
							</div>
						</Button>

						{canCreateAgent ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => setAddSheetOpen(true)}
								className="h-12 w-12 shrink-0 rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
								aria-label={t("createCrew")}
								data-testid="my-crew-create-button"
							>
								<CirclePlus
									className="h-[22px] w-[22px] text-foreground"
									strokeWidth={2}
								/>
							</Button>
						) : null}
					</div>
				</div>

				<div className="px-3 pb-2 pt-1">
					<MyCrewCrewTypeTabs value={crewTypeTab} onChange={handleTabChange} />
				</div>

				<div className="relative min-h-0 flex-1">
					<div
						ref={scrollContainerRef}
						className="no-scrollbar absolute inset-0 overflow-y-auto px-3 pb-8 pt-2"
						onScroll={updateMasks}
						data-testid="my-crew-scroll-container"
					>
						{loading ? (
							<div
								className="flex items-center justify-center py-16"
								data-testid="my-crew-loading"
							>
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : null}

						{!loading && visibleList.length === 0 ? (
							<div
								className="flex flex-col items-center justify-center gap-3 py-16 text-center"
								data-testid="my-crew-empty"
							>
								<p className="text-sm text-muted-foreground">
									{t("myCrewPage.empty")}
								</p>
								{isCreatedTab && canCreateAgent ? (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setAddSheetOpen(true)}
										className="gap-2"
										data-testid="my-crew-empty-create-button"
									>
										<CirclePlus className="h-4 w-4" />
										{t("createCrew")}
									</Button>
								) : null}
							</div>
						) : null}

						{!loading && visibleList.length > 0 ? (
							<>
								<div
									className="grid grid-cols-2 gap-x-2 gap-y-10 py-2.5"
									data-testid="my-crew-card-grid"
								>
									{visibleList.map((employee) => {
										const permissions = resolveTeamSharedCrewPermissions(
											employee.userRole,
										)
										const canOpenTeamSharedActions =
											isTeamSharedTab &&
											(permissions.canPublish || permissions.canDelete)

										return (
											<MyCrewCardMobile
												key={employee.id}
												listVariant={crewTypeTab}
												employee={employee}
												href={getMyCrewPageHref()}
												onNavigate={handleCrewCardNavigate}
												onCardClick={handleOpenDetails}
												onChat={handleOpenConversation}
												onEdit={
													isHiredTab
														? handleOpenDetails
														: isTeamSharedTab && !permissions.canEdit
															? handleOpenDetails
															: handleEdit
												}
												onMoreClick={
													isCreatedTab || canOpenTeamSharedActions
														? handleOpenActions
														: undefined
												}
												onUpgrade={handleUpgrade}
												{...(isHiredTab
													? {
															onDismiss: handleDismissHiredCrew,
															onDisable: handleDisableHiredCrew,
														}
													: { onDelete: handleDeleteCreatedCrew })}
											/>
										)
									})}
								</div>

								<div
									ref={loadMoreSentinelRef}
									className="h-1 w-full"
									data-testid="my-crew-mobile-scroll-sentinel"
								/>

								{shouldShowLoadingMoreIndicator ? (
									<div
										className="flex items-center justify-center py-4"
										data-testid="my-crew-mobile-loading-more"
									>
										<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
									</div>
								) : null}

								{!hasMore ? (
									<div
										className="flex items-center justify-center py-3 text-xs text-muted-foreground/60"
										data-testid="my-crew-mobile-no-more"
									>
										{t("skillsLibrary.noMoreData")}
									</div>
								) : null}
							</>
						) : null}
					</div>

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

/** 页面入口只负责挂接统一移动端壳层，内部行为都收敛到面板组件。 */
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

/** Tabs 与 filter sheet 共用一个三态来源，避免页面内部出现两套分类语义。 */
function resolveFilterTypeFromTab(tab: MyCrewCrewTypeTab): MyCrewMobileFilterState["type"] {
	if (tab === "team-shared") return "teamShared"
	if (tab === "hired") return "fromMarket"
	return "created"
}
