import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "ahooks"
import { InfiniteScroll } from "antd-mobile"
import { reaction } from "mobx"
import { configStore } from "@/models/config"
import { ChevronLeft, Check, MessageCircle, Trash2 } from "lucide-react"
import { IconX } from "@tabler/icons-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicPullToRefresh from "@/components/base-mobile/MagicPullToRefresh"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { userStore } from "@/models/user"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import {
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "@/pages/superMagic/utils/superMagicCache"
import { isOfficialBuiltinPublisherType } from "./employee-market/components/employee-card-shared"
import CategoryFilterMobile from "./components/CategoryFilterMobile"
import EmployeeCardMobile from "./employee-market/components/EmployeeCardMobile"
import { StoreCrewStore } from "./employee-market/stores/store-crew"
import { crewService, type StoreAgentView } from "@/services/crew/CrewService"
import CrewMarketMobileSkeleton from "./components/CrewMarketMobileSkeleton"
import MyCrewDetailSheet from "@/pages/superMagic/pages/MyCrewPage/components/MyCrewDetailSheet"

const HEADER_SHADOW = "0px 8px 25px 0px rgba(0,0,0,0.10)"

function CrewMarketMobilePanelBase() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const storeRef = useRef(new StoreCrewStore())
	const store = storeRef.current
	const [searchKeyword, setSearchKeyword] = useState("")
	const debouncedKeyword = useDebounce(searchKeyword, { wait: 400 })
	const [selectedAgent, setSelectedAgent] = useState<StoreAgentView | null>(null)
	// 解雇二次确认弹窗的目标 agent，非 null 时弹窗可见
	const [dismissConfirmAgent, setDismissConfirmAgent] = useState<StoreAgentView | null>(null)

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

	// Trigger search on debounced keyword changes, skip initial empty render
	const isFirstRender = useRef(true)
	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false
			return
		}
		void store.fetchAgents({ keyword: debouncedKeyword.trim() || undefined, page: 1 })
	}, [debouncedKeyword, store])

	const handleHire = useCallback(
		(id: string) => {
			store.hireAgent(id)
		},
		[store],
	)

	const handleDismiss = useCallback(
		// 接受完整 agent 对象而非 id，避免点击时再次查询 store.list——
		// detail sheet 打开后 store.list 可能因搜索/分类切换被重置，
		// 导致 find 失败或拿到过期的 allowDelete=false，使按钮静默失效。
		(agent: StoreAgentView) => {
			if (!agent.allowDelete) return
			// 打开 MagicPopup 二次确认弹窗，层级通过 overlayZIndex 自动高于底部 Sheet
			setDismissConfirmAgent(agent)
		},
		[],
	)

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

	const handleOpenMarketDetail = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
	)

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
			<MyCrewDetailSheet
				open={selectedAgent != null}
				onOpenChange={(open) => {
					if (!open) setSelectedAgent(null)
				}}
				employee={selectedAgent}
				// 市场来源固定为 "market"，绕过 resolveMyCrewPresentationSource 的字段推断
				presentationSource="market"
				onChat={(agentCode) => handleOpenConversation(agentCode)}
				// 主操作：已雇用 → 开始聊天；未雇用且非 OFFICIAL_BUILTIN → 雇用；OFFICIAL_BUILTIN 未雇用 → 无操作
				primaryAction={
					!selectedAgent
						? undefined
						: selectedAgent.isAdded
							? {
									label: t("chat"),
									icon: <MessageCircle className="h-5 w-5 text-white" />,
									testId: "crew-market-mobile-detail-chat-button",
									// 先关闭 sheet，再导航；custom primaryAction 不会自动触发 onOpenChange(false)
									onClick: () => {
										setSelectedAgent(null)
										handleOpenConversation(selectedAgent.agentCode)
									},
								}
							: isOfficialBuiltinPublisherType(selectedAgent.publisherType)
								? undefined
								: {
										label: t("hire"),
										testId: "crew-market-mobile-detail-hire-button",
										onClick: () => handleHire(selectedAgent.id),
									}
				}
				// 次要操作：已雇用且可删除 → 解雇（显示在主操作左侧，窄宽度）
				secondaryAction={
					selectedAgent?.isAdded && selectedAgent?.allowDelete
						? {
								label: t("dismiss"),
								icon: <Trash2 className="h-4 w-4" />,
								testId: "crew-market-mobile-detail-dismiss-button",
								onClick: () => handleDismiss(selectedAgent),
							}
						: undefined
				}
			/>
			{/* 解雇二次确认弹窗 — 使用 MagicPopup 渲染，层级由 useOverlayZIndex 自动高于底部 Sheet */}
			{dismissConfirmAgent && (
				<MagicPopup
					visible={dismissConfirmAgent != null}
					onClose={() => setDismissConfirmAgent(null)}
					position="bottom"
					title={t("myCrewPage.dismissConfirm.title", {
						name:
							dismissConfirmAgent.name?.trim() ||
							t("crew/create:untitledCrew") ||
							dismissConfirmAgent.agentCode,
					})}
					headerVariant="actionHeader"
					headerTitle={t("myCrewPage.dismissConfirm.title", {
						name:
							dismissConfirmAgent.name?.trim() ||
							t("crew/create:untitledCrew") ||
							dismissConfirmAgent.agentCode,
					})}
					headerLeadingAction={{
						icon: <IconX className="size-5" />,
						ariaLabel: t("cancel"),
						onClick: () => setDismissConfirmAgent(null),
						testId: "crew-dismiss-confirm-cancel",
					}}
					headerTrailingAction={{
						icon: <Check className="size-[22px]" strokeWidth={2.5} />,
						ariaLabel: t("myCrewPage.dismissConfirm.confirm"),
						tone: "destructive",
						onClick: () => {
							const agent = dismissConfirmAgent
							setDismissConfirmAgent(null)
							// 关闭详情 Sheet，再执行解雇
							if (selectedAgent?.id === agent.id) setSelectedAgent(null)
							store.dismissAgent(agent.id)
						},
						testId: "crew-dismiss-confirm-submit",
					}}
					bodyClassName="p-0"
				>
					<div className="px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
						<p className="text-[16px] leading-6 text-muted-foreground">
							{t("myCrewPage.dismissConfirm.description")}
						</p>
					</div>
				</MagicPopup>
			)}

			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
				data-testid="crew-market-page-mobile"
			>
				{/* Header */}
				<header
					className="mobile-page-header relative z-10 flex h-14 shrink-0 items-center gap-2 px-[10px]"
					data-testid="crew-market-mobile-header"
				>
					<button
						type="button"
						onClick={() => navigate({ name: RouteName.MyCrew })}
						className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card transition-transform active:scale-95"
						style={{ boxShadow: HEADER_SHADOW }}
						aria-label={t("back")}
						data-testid="crew-market-mobile-back-button"
					>
						<ChevronLeft className="size-[22px] text-foreground" strokeWidth={2} />
					</button>

					<div
						className="min-w-0 flex-1 px-2 text-center"
						data-testid="crew-market-mobile-title"
					>
						<h1 className="truncate font-poppins text-[18px] font-medium text-foreground">
							{t("title")}
						</h1>
					</div>

					{/* Spacer — same width as back button for visual symmetry */}
					<div className="size-11 shrink-0" aria-hidden />
				</header>

				{/* Category filter — outside scroll area so it stays visible while cards scroll */}
				<div className="shrink-0 px-3" data-testid="crew-market-mobile-filter">
					{/* Only skeleton while categories are loading — keep filter mounted during agent fetch */}
					{store.categoriesLoading && !store.categoriesLoaded ? (
						<div className="flex gap-2 overflow-hidden py-3">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={i} className="h-8 w-[88px] shrink-0 rounded-full" />
							))}
						</div>
					) : (
						<CategoryFilterMobile
							categories={store.categories}
							activeCategoryId={activeCategoryId}
							onCategoryChange={handleCategoryChange}
						/>
					)}
				</div>

				{/*
				 * 真实滚动容器：MagicPullToRefresh 放在内部，PullToRefresh 会在
				 * 滚到顶时拦截下拉手势触发刷新；no-scrollbar 隐藏原生滚动条。
				 */}
				<div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
					<MagicPullToRefresh
						onRefresh={() => store.fetchAgents({ page: 1 })}
						showSuccessMessage={false}
					>
						<div className="flex w-full min-w-0 flex-col gap-4 px-3 pb-6 pt-3">
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
									className="flex flex-col gap-3"
									data-testid="employee-card-list"
								>
									{store.list.map((employee) => (
										<EmployeeCardMobile
											key={employee.id}
											employee={employee}
											onHire={handleHire}
											onDetails={handleDetails}
											onOpenMarketDetail={handleOpenMarketDetail}
										/>
									))}
								</div>
							) : null}

							{/* InfiniteScroll 放在列表末尾，滚动到底部时自动加载下一页 */}
							{!store.loading && store.list.length > 0 ? (
								<InfiniteScroll
									hasMore={store.hasMore}
									loadMore={() => store.loadMore()}
								/>
							) : null}
						</div>
					</MagicPullToRefresh>
				</div>

				{/* Bottom search bar */}
				<MobileBottomSearchBar
					value={searchKeyword}
					placeholder={t("aiSearchPlaceholder")}
					clearAriaLabel={t("mobile.clearSearch")}
					onValueChange={setSearchKeyword}
					testIdPrefix="crew-market-mobile-search"
				/>
			</div>
		</>
	)
}

const CrewMarketMobilePanel = observer(CrewMarketMobilePanelBase)

export default function CrewMarketMobilePage() {
	return <CrewMarketMobilePanel />
}
