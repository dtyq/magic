import { useCallback, useEffect, useRef, useState } from "react"
import { reaction } from "mobx"
import { configStore } from "@/models/config"
import { Check, Loader2, Menu, Search, UserRoundCog } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn-ui/sheet"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { userStore } from "@/models/user"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CrewDetailDialog } from "@/pages/superMagic/components/CrewDetailDialog"
import {
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "@/pages/superMagic/utils/superMagicCache"
import {
	isEmployeeMarketPrimaryActionDisabled,
	resolveEmployeeMarketPrimaryActionLabel,
} from "./employee-market/components/employee-card-shared"
import CategoryFilter from "./employee-market/components/CategoryFilter"
import EmployeeCardMobile from "./employee-market/components/EmployeeCardMobile"
import { StoreCrewStore } from "./employee-market/stores/store-crew"
import { crewService, type StoreAgentView } from "@/services/crew/CrewService"
import {
	SuperMobileShellRouteLayout,
	useSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell"

const SKELETON_CARD_COUNT = 6

/** 占位骨架保持现有数据请求节奏不变，仅负责在首屏加载时兜住两列卡片布局。 */
function CrewMarketMobileSkeleton() {
	return (
		<div className="flex flex-col gap-4" data-testid="crew-market-mobile-skeleton">
			<div className="flex gap-2 overflow-hidden py-0.5">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={i} className="h-9 w-[88px] shrink-0 rounded-full" />
				))}
			</div>
			<div className="grid grid-cols-2 gap-3">
				{Array.from({ length: SKELETON_CARD_COUNT }).map((_, i) => (
					<div
						key={i}
						className="flex flex-col gap-1.5 rounded-md border border-border bg-popover p-2 pt-10 shadow-xs"
					>
						<Skeleton className="mx-auto size-16 shrink-0 rounded-full" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="mx-auto h-5 w-3/4 max-w-[140px]" />
						<Skeleton className="h-3 w-full" />
						<Skeleton className="h-3 w-5/6" />
						<Skeleton className="h-7 w-full rounded-md" />
						<div className="mt-1 flex items-center justify-between gap-2 border-t border-border pt-2">
							<Skeleton className="h-3 w-14" />
							<Skeleton className="h-5 w-9 rounded-md" />
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

/** 市场页面板只关心业务内容，侧栏开关由外层 `SuperMobileShellRouteLayout` 注入。 */
function CrewMarketMobilePanelBase() {
	const { t } = useTranslation("crew/market")
	const { openSidebar } = useSuperMobileShellOutlet()
	const navigate = useNavigate()
	const storeRef = useRef(new StoreCrewStore())
	const store = storeRef.current
	const { confirm, dialog } = useConfirmDialog()

	const [searchOpen, setSearchOpen] = useState(false)
	const [queryDraft, setQueryDraft] = useState("")
	const [selectedAgent, setSelectedAgent] = useState<StoreAgentView | null>(null)

	useEffect(() => {
		store.fetchCategories()
		void store.fetchAgents()
		return () => store.reset()
	}, [store])

	useEffect(() => {
		return reaction(
			() => configStore.i18n.displayLanguage,
			() => {
				store.refreshAfterLanguageChange()
			},
		)
	}, [store])

	// 打开搜索抽屉时回填当前关键字，避免用户重复输入。
	function handleSearchOpenChange(open: boolean) {
		setSearchOpen(open)
		if (open) setQueryDraft(store.keyword)
	}

	// 搜索只在确认后落库，避免输入过程频繁触发请求。
	function handleApplySearch() {
		void store.fetchAgents({ keyword: queryDraft.trim(), page: 1 })
		setSearchOpen(false)
	}

	// 雇佣入口沿用原有 store/service，当前改造只替换移动端外壳与视觉结构。
	const handleHire = useCallback(
		(id: string) => {
			store.hireAgent(id)
		},
		[store],
	)

	// 删除确认继续复用既有危险操作弹窗，避免移动端重构时改动业务规则。
	const handleDismiss = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target?.allowDelete) return
			const displayName =
				target.name?.trim() || t("crew/create:untitledCrew") || target.agentCode
			confirm({
				title: t("myCrewPage.dismissConfirm.title", { name: displayName }),
				description: t("myCrewPage.dismissConfirm.description"),
				confirmText: t("myCrewPage.dismissConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => {
					if (selectedAgent?.id === id) setSelectedAgent(null)
					store.dismissAgent(id)
				},
			})
		},
		[confirm, selectedAgent?.id, store, t],
	)

	// 对话页仍按当前工作区兜底跳转，保证市场卡片“开始对话”不依赖新路由能力。
	function resolveFallbackWorkspaceId() {
		const userInfo = userStore.user.userInfo
		const cachedWorkspaceState = WorkspaceStateCache.get(userInfo)
		return cachedWorkspaceState.workspaceId || UserWorkspaceMapCache.get(userInfo)
	}

	// 市场里的“开始对话”保持原有 pin + 跳转逻辑，仅借壳层承接新的移动端导航样式。
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

	// 点击卡片时优先打开详情，避免在市场列表里直接触发副作用操作。
	const handleOpenMarketDetail = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
	)

	// 已雇佣的员工从详情按钮直接进入会话，未雇佣时仍打开详情面板。
	const handleDetails = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target) return
			if (target.isAdded) {
				handleOpenConversation(target.agentCode)
				return
			}
			setSelectedAgent(target)
		},
		[handleOpenConversation, store],
	)

	const activeCategoryId = store.categoryId ?? "all"

	// 分类切换只在值变化时触发请求，避免横向筛选条重复点击导致无效刷新。
	const handleCategoryChange = useCallback(
		(categoryId: string) => {
			if (categoryId === activeCategoryId) return
			store.fetchAgents({
				category_id: categoryId === "all" ? undefined : categoryId,
				page: 1,
			})
		},
		[activeCategoryId, store],
	)

	return (
		<>
			<CrewDetailDialog
				open={selectedAgent != null}
				onOpenChange={(open) => {
					if (!open) setSelectedAgent(null)
				}}
				agentCode={selectedAgent?.agentCode ?? null}
				detailSource="market"
				versionCode={selectedAgent?.latestVersionCode}
				avatarUrl={selectedAgent?.icon}
				primaryAction={
					selectedAgent
						? {
								label: resolveEmployeeMarketPrimaryActionLabel(selectedAgent, t),
								variant: selectedAgent.allowDelete ? "destructive" : "default",
								disabled: isEmployeeMarketPrimaryActionDisabled(selectedAgent),
								testId: "crew-market-mobile-detail-action-button",
								onClick: () =>
									selectedAgent.allowDelete
										? handleDismiss(selectedAgent.id)
										: store.hireAgent(selectedAgent.id),
							}
						: undefined
				}
			/>
			{dialog}
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
				data-testid="crew-market-page-mobile"
			>
				<header
					className="relative z-10 flex shrink-0 items-center gap-1 px-4 pb-3 pt-2"
					data-testid="crew-market-mobile-header"
				>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-11 w-11 shrink-0 rounded-full border border-border/10 bg-background shadow-[0px_4px_12px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
						onClick={openSidebar}
						aria-label={t("super:mobile.shell.menuAria")}
						data-testid="crew-market-mobile-menu-button"
					>
						<Menu className="size-6 text-foreground" strokeWidth={2.25} aria-hidden />
					</Button>
					<div
						className="min-w-0 flex-1 px-2 text-center"
						data-testid="crew-market-mobile-title"
					>
						<h1 className="truncate font-poppins text-[19px] font-semibold tracking-tight text-foreground">
							{t("title")}
						</h1>
					</div>
					<div className="flex shrink-0 items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-11 w-11 rounded-full border border-border/10 bg-background shadow-[0px_4px_12px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
							onClick={() => handleSearchOpenChange(true)}
							aria-label={t("mobile.searchSheetTitle")}
							data-testid="crew-market-mobile-search-open"
						>
							<Search className="size-5" aria-hidden />
						</Button>
						<Button
							type="button"
							variant="ghost"
							className="h-11 shrink-0 gap-1 rounded-full border border-border/10 bg-background px-3 text-xs font-medium text-foreground shadow-[0px_4px_12px_rgba(0,0,0,0.06)] transition-transform active:scale-95"
							onClick={() => navigate({ name: RouteName.MyCrew })}
							data-testid="crew-market-mobile-my-crew"
						>
							<UserRoundCog className="size-4 shrink-0" aria-hidden />
							{t("myCrew")}
						</Button>
					</div>
				</header>

				<Sheet open={searchOpen} onOpenChange={handleSearchOpenChange}>
					<SheetContent
						side="bottom"
						aria-describedby={undefined}
						className="rounded-t-xl px-4 pb-6"
						data-testid="crew-market-mobile-search-sheet"
					>
						<SheetHeader className="text-left">
							<SheetTitle>{t("mobile.searchSheetTitle")}</SheetTitle>
						</SheetHeader>
						<div className="flex flex-col gap-3">
							<Input
								value={queryDraft}
								onChange={(e) => setQueryDraft(e.target.value)}
								placeholder={t("aiSearchPlaceholder")}
								onKeyDown={(e) => {
									if (e.key !== "Enter" || e.nativeEvent.isComposing) return
									handleApplySearch()
								}}
								data-testid="crew-market-mobile-search-input"
							/>
							<Button
								className="w-full gap-2 shadow-xs"
								onClick={handleApplySearch}
								data-testid="crew-market-mobile-search-submit"
							>
								<Search className="size-4" />
								{t("mobile.runSearch")}
							</Button>
						</div>
					</SheetContent>
				</Sheet>

				<ScrollArea className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block">
					<div className="flex w-full min-w-0 flex-col gap-4 px-3 pb-6 pt-3">
						<div className="flex min-w-0 flex-col gap-4">
							{!store.loading ? (
								<CategoryFilter
									categories={store.categories}
									activeCategoryId={activeCategoryId}
									onCategoryChange={handleCategoryChange}
								/>
							) : null}

							{store.loading ? <CrewMarketMobileSkeleton /> : null}

							{store.isEmpty ? (
								<div
									className="flex flex-col items-center justify-center py-12 text-center"
									data-testid="crew-market-empty"
								>
									<p className="text-sm text-muted-foreground">
										{store.keyword ? t("noResults") : t("noMoreData")}
									</p>
								</div>
							) : null}

							{!store.loading && store.list.length > 0 ? (
								<div
									className="grid grid-cols-2 gap-3 [&>*]:min-h-0"
									data-testid="employee-card-grid"
								>
									{store.list.map((employee) => (
										<EmployeeCardMobile
											key={employee.id}
											employee={employee}
											onHire={handleHire}
											onDismiss={handleDismiss}
											onDetails={handleDetails}
											onOpenMarketDetail={handleOpenMarketDetail}
										/>
									))}
								</div>
							) : null}

							{!store.loading && store.list.length > 0 ? (
								<div className="flex items-center justify-center py-2">
									{store.hasMore ? (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => store.loadMore()}
											disabled={store.loadingMore}
											data-testid="crew-market-load-more"
										>
											{store.loadingMore ? (
												<Loader2 className="mr-2 size-4 animate-spin" />
											) : null}
											{store.loadingMore ? t("loadingMore") : t("loadMore")}
										</Button>
									) : (
										<div
											className="flex items-center justify-center gap-1 opacity-30"
											data-testid="crew-market-no-more"
										>
											<Check className="size-4" />
											<span className="text-xs">{t("noMoreData")}</span>
										</div>
									)}
								</div>
							) : null}
						</div>
					</div>
				</ScrollArea>
			</div>
		</>
	)
}

const CrewMarketMobilePanel = observer(CrewMarketMobilePanelBase)

/** 市场页通过统一移动端壳层承接主题同步、侧栏导航与全屏圆角裁切。 */
export default function CrewMarketMobilePage() {
	const { t } = useTranslation("super")

	return (
		<SuperMobileShellRouteLayout
			activeView="myCrew"
			closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
			testIdPrefix="crew-market-shell"
		>
			<CrewMarketMobilePanel />
		</SuperMobileShellRouteLayout>
	)
}
