import { useEffect, useCallback, useRef, useState } from "react"
import { useMatch } from "react-router"
import { Check, CirclePlus, Loader2, UserRoundCog } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { SmoothTabs } from "@/opensource/components/shadcn-ui/smooth-tabs"
import useNavigate from "@/opensource/routes/hooks/useNavigate"
import { RouteName } from "@/opensource/routes/constants"
import { crewService } from "@/opensource/services/crew/CrewService"
import SearchBar from "./components/SearchBar"
import CategoryFilter from "./components/CategoryFilter"
import EmployeeCard from "./components/EmployeeCard"
import SkillsLibrary from "./components/SkillsLibrary"
import PageTopBar from "@/opensource/pages/superMagic/components/PageTopBar"
import { StoreCrewStore } from "./stores/store-crew"

type TabValue = "crew-market" | "skills-library"

function CrewMarketPage() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const isSkillsRoute = useMatch("/:clusterCode/market/skills")
	const activeTab: TabValue = isSkillsRoute ? "skills-library" : "crew-market"
	const storeRef = useRef(new StoreCrewStore())
	const store = storeRef.current

	useEffect(() => {
		if (activeTab === "crew-market") {
			store.fetchCategories()
			store.fetchAgents()
		}
		return () => store.reset()
	}, [store, activeTab])

	const [isCreating, setIsCreating] = useState(false)

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

	function handleTabChange(value: TabValue) {
		if (value === "skills-library") {
			navigate({ name: RouteName.CrewMarketSkills })
		} else {
			navigate({ name: RouteName.CrewMarketCrew })
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

	const handleUpgrade = useCallback(
		(id: string) => {
			store.upgradeAgent(id)
		},
		[store],
	)

	const handleDetails = useCallback((id: string) => {
		void id
		// TODO: navigate to agent detail page
	}, [])

	const handleSearch = useCallback(
		(query: string) => {
			store.fetchAgents({ keyword: query, page: 1 })
		},
		[store],
	)

	const handleCategoryChange = useCallback(
		(categoryId: string) => {
			store.fetchAgents({
				category_id: categoryId === "all" ? undefined : categoryId,
				page: 1,
			})
		},
		[store],
	)

	const activeCategoryId = store.categoryId ?? "all"

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
			data-testid="crew-market-page"
		>
			{/* Top header bar */}
			<PageTopBar
				data-testid="crew-market-top-bar"
				backButtonTestId="crew-market-back-button"
			/>

			{/* Main scrollable section */}
			<ScrollArea className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block">
				<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
					<div className="w-full min-w-0" data-testid="crew-market-tabs">
						<SmoothTabs
							tabs={[
								{ value: "crew-market" as TabValue, label: t("tabs.crewMarket") },
								{
									value: "skills-library" as TabValue,
									label: t("tabs.skillsLibrary"),
								},
							]}
							value={activeTab}
							onChange={handleTabChange}
							variant="background"
							className="h-9 w-full bg-muted p-[3px] sm:w-[260px]"
							buttonClassName="rounded-md text-sm py-0 h-[30px]"
							indicatorClassName="h-[30px] inset-y-[3px]"
						/>

						{activeTab === "crew-market" && (
							<div className="mt-5 flex min-w-0 flex-col gap-5 sm:mt-6 sm:gap-6">
								{/* Title + action buttons */}
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

								{/* AI Search */}
								{/* <SearchBar onSearch={handleSearch} /> */}

								{/* Category filter */}
								<CategoryFilter
									categories={store.categories}
									activeCategoryId={activeCategoryId}
									onCategoryChange={handleCategoryChange}
								/>

								{/* Loading state */}
								{store.loading && (
									<div
										className="flex items-center justify-center py-16"
										data-testid="crew-market-loading"
									>
										<Loader2 className="size-6 animate-spin text-muted-foreground" />
									</div>
								)}

								{/* Empty state */}
								{store.isEmpty && (
									<div
										className="flex flex-col items-center justify-center py-16 text-center"
										data-testid="crew-market-empty"
									>
										<p className="text-sm text-muted-foreground">
											{t("noResults")}
										</p>
									</div>
								)}

								{/* Employee card grid */}
								{!store.loading && store.list.length > 0 && (
									<div
										className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
										data-testid="employee-card-grid"
									>
										{store.list.map((employee) => (
											<EmployeeCard
												key={employee.id}
												employee={employee}
												onHire={handleHire}
												onDismiss={handleDismiss}
												onUpgrade={handleUpgrade}
												onDetails={handleDetails}
											/>
										))}
									</div>
								)}

								{/* Load more / no more data footer */}
								{!store.loading && store.list.length > 0 && (
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
								)}
							</div>
						)}

						{activeTab === "skills-library" && <SkillsLibrary />}
					</div>
				</div>
			</ScrollArea>
		</div>
	)
}

export default observer(CrewMarketPage)
