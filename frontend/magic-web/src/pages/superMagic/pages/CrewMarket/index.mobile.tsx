import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, Loader2, Search, UserRoundCog } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn-ui/sheet"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CrewDetailDialog } from "@/pages/superMagic/components/CrewDetailDialog"
import {
	isEmployeeMarketPrimaryActionDisabled,
	resolveEmployeeMarketPrimaryActionLabel,
} from "./employee-market/components/employee-card-shared"
import CategoryFilter from "./employee-market/components/CategoryFilter"
import EmployeeCardMobile from "./employee-market/components/EmployeeCardMobile"
import { StoreCrewStore } from "./employee-market/stores/store-crew"
import type { StoreAgentView } from "@/services/crew/CrewService"

const SKELETON_CARD_COUNT = 6

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

function CrewMarketMobilePage() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const storeRef = useRef(new StoreCrewStore())
	const store = storeRef.current

	const [searchOpen, setSearchOpen] = useState(false)
	const [queryDraft, setQueryDraft] = useState("")
	const [selectedAgent, setSelectedAgent] = useState<StoreAgentView | null>(null)

	useEffect(() => {
		store.fetchCategories()
		void store.fetchAgents()
		return () => store.reset()
	}, [store])

	function handleSearchOpenChange(open: boolean) {
		setSearchOpen(open)
		if (open) setQueryDraft(store.keyword)
	}

	function handleApplySearch() {
		void store.fetchAgents({ keyword: queryDraft.trim(), page: 1 })
		setSearchOpen(false)
	}

	const handleHire = useCallback(
		(id: string) => {
			store.hireAgent(id)
		},
		[store],
	)

	const handleDismiss = useCallback(
		(id: string) => {
			store.dismissAgent(id)
		},
		[store],
	)

	const handleDetails = useCallback(
		(id: string) => {
			const target = store.list.find((item) => item.id === id)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
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
										? store.dismissAgent(selectedAgent.id)
										: store.hireAgent(selectedAgent.id),
							}
						: undefined
				}
			/>
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-t-0 border-border bg-background shadow-xs"
				data-testid="crew-market-page-mobile"
			>
				<header className="flex shrink-0 items-center gap-2 rounded-b-xl bg-background px-2.5 py-2 shadow-xs">
					<Button
						variant="ghost"
						size="icon"
						className="size-8 shrink-0 rounded-lg"
						onClick={() =>
							navigate({
								delta: -1,
								viewTransition: {
									type: "slide",
									direction: "right",
									duration: 300,
								},
							})
						}
						aria-label={t("back")}
						data-testid="crew-market-mobile-back"
					>
						<ChevronLeft className="size-6" aria-hidden />
					</Button>
					<h1 className="min-w-0 flex-1 truncate text-left text-base font-medium leading-6 text-foreground">
						{t("title")}
					</h1>
					<div className="flex shrink-0 items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							className="size-8 rounded-md"
							onClick={() => handleSearchOpenChange(true)}
							aria-label={t("mobile.searchSheetTitle")}
							data-testid="crew-market-mobile-search-open"
						>
							<Search className="size-4" aria-hidden />
						</Button>
						<Button
							variant="ghost"
							className="h-8 shrink-0 gap-1 rounded-md px-2 text-xs font-medium text-foreground"
							onClick={() => navigate({ name: RouteName.MyCrew })}
							data-testid="crew-market-mobile-my-crew"
						>
							<UserRoundCog className="size-4 shrink-0" aria-hidden />
							{t("myCrew")}
						</Button>
					</div>
				</header>

				<Sheet open={searchOpen} onOpenChange={handleSearchOpenChange}>
					<SheetContent side="bottom" className="rounded-t-xl px-4 pb-6">
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
											{t("loadMore")}
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

export default observer(CrewMarketMobilePage)
