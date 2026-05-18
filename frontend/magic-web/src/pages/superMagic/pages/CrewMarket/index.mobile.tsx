import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounce } from "ahooks"
import { InfiniteScroll } from "antd-mobile"
import { reaction } from "mobx"
import { configStore } from "@/models/config"
import { ChevronLeft, MessageCircle, Trash2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
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
import {
	isOfficialBuiltinPublisherType,
} from "./employee-market/components/employee-card-shared"
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
	const { confirm, dialog } = useConfirmDialog()

	const [searchKeyword, setSearchKeyword] = useState("")
	const debouncedKeyword = useDebounce(searchKeyword, { wait: 400 })
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
									onClick: () => handleOpenConversation(selectedAgent.agentCode),
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
								onClick: () => handleDismiss(selectedAgent.id),
							}
						: undefined
				}
			/>
			{dialog}

			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background"
				data-testid="crew-market-page-mobile"
			>
				{/* Header */}
				<header
					className="relative z-10 flex h-14 shrink-0 items-center gap-2 px-[10px]"
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
					{store.loading ? (
						// Skeleton pills matching the real filter height/shape
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
								<div className="flex flex-col gap-3" data-testid="employee-card-list">
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
