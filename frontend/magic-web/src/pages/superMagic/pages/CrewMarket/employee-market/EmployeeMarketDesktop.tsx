import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"
import { useDebounce, useThrottle } from "ahooks"
import { Check, CirclePlus, Loader2, UserRoundCog } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { CrewDetailDialog } from "@/pages/superMagic/components/CrewDetailDialog"
import { crewService } from "@/services/crew/CrewService"
import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
import {
	isEmployeeMarketPrimaryActionDisabled,
	resolveEmployeeMarketPrimaryActionLabel,
} from "./components/employee-card-shared"
import CategoryFilter from "./components/CategoryFilter"
import EmployeeCard from "./components/EmployeeCard"
import { useAutoLoadMoreSentinel } from "./hooks/useAutoLoadMoreSentinel"
import { StoreCrewStore } from "./stores/store-crew"
import type { StoreAgentView } from "@/services/crew/CrewService"

const CREW_MARKET_SEARCH_DEBOUNCE_MS = 300
const CREW_MARKET_SEARCH_THROTTLE_MS = 400

interface EmployeeMarketDesktopProps {
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

function EmployeeMarketDesktop({ scrollViewportRef }: EmployeeMarketDesktopProps) {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const storeRef = useRef(new StoreCrewStore())
	const store = storeRef.current
	const handleAutoLoadMore = useCallback(() => {
		void store.loadMore()
	}, [store])
	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled: store.loading || store.loadingMore || !store.hasMore,
		onLoadMore: handleAutoLoadMore,
	})

	const [isCreating, setIsCreating] = useState(false)
	const [selectedAgent, setSelectedAgent] = useState<StoreAgentView | null>(null)

	const [searchQuery, setSearchQuery] = useState("")
	const [isSearchComposing, setIsSearchComposing] = useState(false)
	const debouncedSearchQuery = useDebounce(searchQuery, { wait: CREW_MARKET_SEARCH_DEBOUNCE_MS })
	const throttledSearchQuery = useThrottle(debouncedSearchQuery, {
		wait: CREW_MARKET_SEARCH_THROTTLE_MS,
	})

	useEffect(() => {
		store.fetchCategories()
		return () => store.reset()
	}, [store])

	// Debounced keyword search; skip while IME is composing (CJK input).
	useEffect(() => {
		if (isSearchComposing) return
		const kw = throttledSearchQuery.trim()
		void store.fetchAgents({ keyword: kw || undefined, page: 1 })
	}, [store, throttledSearchQuery, isSearchComposing])

	async function handleCreateCrew() {
		if (isCreating) return
		setIsCreating(true)
		try {
			const { code } = await crewService.createDefaultAgent()
			navigate({ name: RouteName.CrewEdit, params: { id: code } })
		} catch {
			// Error handled by service / UI
		} finally {
			setIsCreating(false)
		}
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

	const handleSearch = useCallback(() => {
		if (isSearchComposing) return
		const keyword = searchQuery.trim()
		void store.fetchAgents({ keyword: keyword || undefined, page: 1 })
	}, [isSearchComposing, searchQuery, store])

	const onSearchCompositionStart = useCallback(() => setIsSearchComposing(true), [])
	const onSearchCompositionEnd = useCallback(() => setIsSearchComposing(false), [])

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
								testId: "crew-market-detail-action-button",
								onClick: () =>
									selectedAgent.allowDelete
										? store.dismissAgent(selectedAgent.id)
										: store.hireAgent(selectedAgent.id),
							}
						: undefined
				}
			/>
			<div className="mt-5 flex min-w-0 flex-col gap-5 sm:mt-6 sm:gap-6">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<h1 className="break-words text-2xl leading-tight text-foreground sm:text-3xl lg:text-4xl">
							{t("title")}
						</h1>
						<p className="max-w-2xl break-words text-sm text-muted-foreground">
							{t("subtitle")}
						</p>
					</div>
					<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
						<Button
							className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
							onClick={handleCreateCrew}
							disabled={isCreating}
							data-testid="crew-market-create-button"
						>
							{isCreating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<CirclePlus className="h-4 w-4" />
							)}
							{t("createCrew")}
						</Button>
						<Button
							variant="outline"
							className="h-9 flex-1 gap-2 bg-background shadow-xs sm:flex-none"
							onClick={() => navigate({ name: RouteName.MyCrew })}
							data-testid="crew-market-my-crew-button"
						>
							<UserRoundCog className="h-4 w-4" />
							{t("myCrew")}
						</Button>
					</div>
				</div>

				<SearchBar
					value={searchQuery}
					onChange={setSearchQuery}
					onSearch={handleSearch}
					onCompositionStart={onSearchCompositionStart}
					onCompositionEnd={onSearchCompositionEnd}
					placeholder={t("aiSearchPlaceholder")}
					enableSearchSubmit
					data-testid="crew-market-desktop-search-bar"
				/>

				<CategoryFilter
					categories={store.categories}
					activeCategoryId={activeCategoryId}
					onCategoryChange={handleCategoryChange}
				/>

				{store.loading ? (
					<div
						className="flex items-center justify-center py-16"
						data-testid="crew-market-loading"
					>
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				) : null}

				{store.isEmpty ? (
					<div
						className="flex flex-col items-center justify-center py-16 text-center"
						data-testid="crew-market-empty"
					>
						<p className="text-sm text-muted-foreground">
							{store.keyword ? t("noResults") : t("noMoreData")}
						</p>
					</div>
				) : null}

				{!store.loading && store.list.length > 0 ? (
					<div
						className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
						data-testid="employee-card-grid"
					>
						{store.list.map((employee) => (
							<EmployeeCard
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
					<div
						ref={loadMoreSentinelRef}
						className="h-1 w-full"
						data-testid="crew-market-scroll-sentinel"
					/>
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
		</>
	)
}

export default observer(EmployeeMarketDesktop)
