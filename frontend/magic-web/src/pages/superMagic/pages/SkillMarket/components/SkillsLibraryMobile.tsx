import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { InfiniteScroll } from "antd-mobile"
import { reaction } from "mobx"
import { configStore } from "@/models/config"
import { ChevronLeft, Loader2, Search } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn-ui/sheet"
import { Skills } from "@/enhance/lucide-react"
import { SkillDetailDialog } from "@/pages/superMagic/components/SkillDetailDialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { StoreSkillCardMobile } from "./StoreSkillCardMobile"
import { StoreSkillsStore } from "../stores/store-skills"
import SkillCategoryFilter from "./SkillCategoryFilter"
import { ViewTransitionPresets } from "@/types/viewTransition"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import SkillMarketTabs, { SKILL_MARKET_TAB_VALUES, type SkillMarketTab } from "./SkillMarketTabs"

interface SkillsLibraryMobileProps {
	activeTab?: SkillMarketTab
	onTabChange?: (value: SkillMarketTab) => void
}

function SkillsLibraryMobile({
	activeTab = SKILL_MARKET_TAB_VALUES.skills,
	onTabChange = () => undefined,
}: SkillsLibraryMobileProps) {
	const { t, i18n } = useTranslation("crew/market")
	const navigate = useNavigate()
	const skillsStoreRef = useRef(new StoreSkillsStore())
	const skillsStore = skillsStoreRef.current
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const initialLoadLifecycleRef = useRef({ initialized: false, generation: 0 })

	const [searchOpen, setSearchOpen] = useState(false)
	const [queryDraft, setQueryDraft] = useState("")
	const [selectedSkill, setSelectedSkill] = useState<StoreSkillView | null>(null)
	const hasActiveFilters =
		Boolean(skillsStore.keyword) ||
		skillsStore.categoryIds.length > 0 ||
		skillsStore.publisherType != null ||
		skillsStore.isFeatured != null

	useEffect(() => {
		const lifecycle = initialLoadLifecycleRef.current
		const effectGeneration = ++lifecycle.generation

		// React StrictMode replays effects in development. Keep the first request
		// alive and avoid starting the same initial queries a second time.
		if (!lifecycle.initialized) {
			lifecycle.initialized = true
			void skillsStore.fetchSkills()
			void skillsStore.fetchCategories()
		}

		return () => {
			queueMicrotask(() => {
				if (lifecycle.generation === effectGeneration) skillsStore.reset()
			})
		}
	}, [skillsStore])

	useEffect(() => {
		return reaction(
			() => configStore.i18n.displayLanguage,
			() => {
				skillsStore.refreshAfterLanguageChange()
			},
		)
	}, [skillsStore])

	const handleAutoLoadMore = useCallback(() => {
		void skillsStore.loadMore()
	}, [skillsStore])

	function handleSearchOpenChange(open: boolean) {
		setSearchOpen(open)
		if (open) setQueryDraft(skillsStore.keyword)
	}

	function handleApplySearch() {
		void skillsStore.fetchSkills({ keyword: queryDraft.trim(), page: 1 }).catch(() => undefined)
		setSearchOpen(false)
	}

	const handleBack = useCallback(() => {
		navigate({
			delta: -1,
			viewTransition: ViewTransitionPresets.slideRight,
		})
	}, [navigate])

	const handleAdd = useCallback(
		(id: string) => {
			void skillsStore.addSkill(id).catch(() => {
				toast.error(t("skillsLibrary.addFailed"))
			})
		},
		[skillsStore, t],
	)

	const handleCategoryChange = useCallback(
		(categoryIds: string[], isFeatured?: 0 | 1) => {
			void skillsStore
				.fetchSkills({ page: 1, category_ids: categoryIds, is_featured: isFeatured })
				.catch(() => undefined)
		},
		[skillsStore],
	)

	const handleOpenDetail = useCallback((skill: StoreSkillView) => {
		setSelectedSkill(skill)
	}, [])

	const handleRetrySkills = useCallback(() => {
		void skillsStore.retrySkills().catch(() => undefined)
	}, [skillsStore])

	const selectedSkillId = selectedSkill?.id
	const selectedSkillStatus = selectedSkill?.status
	const detailPrimaryAction = useMemo(
		() =>
			selectedSkillId
				? {
						label:
							selectedSkillStatus === "added"
								? t("skillsLibrary.added")
								: t("skillsLibrary.addToMySkills"),
						onClick: async () => {
							if (selectedSkillStatus === "added") {
								return
							}

							await skillsStore.addSkill(selectedSkillId)
						},
						onError: () => toast.error(t("skillsLibrary.actionFailed")),
						disabled: selectedSkillStatus === "added",
						testId: "skill-detail-dialog-primary-action",
					}
				: undefined,
		[selectedSkillId, selectedSkillStatus, skillsStore, t],
	)

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-t-0 border-border bg-background shadow-xs"
			data-testid="skills-library-mobile-page"
		>
			<SkillDetailDialog
				open={selectedSkill != null}
				onOpenChange={(nextOpen) => {
					if (nextOpen) return
					setSelectedSkill(null)
				}}
				skillCode={selectedSkill?.skillCode ?? null}
				detailSource="market"
				skillSummary={selectedSkill}
				primaryAction={detailPrimaryAction}
			/>
			<header
				className="flex shrink-0 items-center gap-2 rounded-b-xl bg-background px-2.5 py-2 shadow-xs"
				data-testid="skills-library-mobile-top-bar"
			>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 rounded-lg"
					onClick={handleBack}
					aria-label={t("back")}
					data-testid="skills-library-mobile-back"
				>
					<ChevronLeft className="size-6" aria-hidden />
				</Button>
				<SkillMarketTabs
					value={activeTab}
					onValueChange={onTabChange}
					className="min-w-0 flex-1"
					compact
				/>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="size-8 rounded-md"
						onClick={() => handleSearchOpenChange(true)}
						aria-label={t("skillsLibrary.searchAria")}
						data-testid="skills-library-mobile-search-open"
					>
						<Search className="size-4" aria-hidden />
					</Button>
					<Button
						variant="ghost"
						className="h-8 shrink-0 gap-1 rounded-md px-2 text-xs font-medium text-foreground"
						onClick={() => navigate({ name: RouteName.MySkills })}
						data-testid="skills-library-mobile-my-skills"
					>
						<Skills className="size-4 shrink-0" aria-hidden />
						{t("skillsLibrary.mySkills")}
					</Button>
				</div>
			</header>

			{activeTab === SKILL_MARKET_TAB_VALUES.skills ? (
				<>
					<div
						className="shrink-0 border-b border-border bg-background px-3"
						data-testid="skills-library-mobile-filter"
					>
						<SkillCategoryFilter
							categories={skillsStore.categories}
							selectedCategoryIds={skillsStore.categoryIds}
							selectedIsFeatured={skillsStore.isFeatured}
							loading={skillsStore.categoriesLoading}
							error={skillsStore.categoriesError}
							onChange={handleCategoryChange}
						/>
					</div>

					<Sheet open={searchOpen} onOpenChange={handleSearchOpenChange}>
						<SheetContent side="bottom" className="rounded-t-xl px-4 pb-6">
							<SheetHeader className="text-left">
								<SheetTitle>{t("skillsLibrary.searchSheetTitle")}</SheetTitle>
							</SheetHeader>
							<div className="flex flex-col gap-3">
								<Input
									value={queryDraft}
									onChange={(e) => setQueryDraft(e.target.value)}
									placeholder={t("skillsLibrary.aiSearchPlaceholder")}
									onKeyDown={(e) => {
										if (e.key !== "Enter" || e.nativeEvent.isComposing) return
										handleApplySearch()
									}}
									data-testid="skills-library-mobile-search-input"
								/>
								<Button
									className="w-full gap-2 shadow-xs"
									onClick={handleApplySearch}
									data-testid="skills-library-mobile-search-submit"
								>
									<Search className="size-4" />
									{t("mobile.runSearch")}
								</Button>
							</div>
						</SheetContent>
					</Sheet>

					<ScrollArea
						className="min-h-0 flex-1 [&_[data-slot='scroll-area-scrollbar']]:hidden [&_[data-slot='scroll-area-viewport']>div]:!block"
						viewportRef={scrollViewportRef}
					>
						<div className="flex min-w-0 flex-col gap-4 px-2 pb-6 pt-2">
							{skillsStore.listError ? (
								<div
									className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground"
									data-testid="skills-library-mobile-error"
								>
									<span>{t("skillsLibrary.loadFailed")}</span>
									<Button variant="outline" size="sm" onClick={handleRetrySkills}>
										{t("skillsLibrary.retrySkills")}
									</Button>
								</div>
							) : skillsStore.loading && skillsStore.list.length === 0 ? (
								<div
									className="flex items-center justify-center py-16"
									data-testid="skills-library-mobile-loading"
								>
									<Loader2 className="size-6 animate-spin text-muted-foreground" />
								</div>
							) : skillsStore.isEmpty ? (
								<div
									className="flex items-center justify-center py-16 text-sm text-muted-foreground"
									data-testid="skills-library-mobile-empty"
								>
									{hasActiveFilters
										? t("noResults")
										: t("skillsLibrary.noMoreData")}
								</div>
							) : (
								<div
									className="flex flex-col gap-2.5"
									data-testid="skills-library-mobile-list"
								>
									{skillsStore.list.map((skill) => (
										<StoreSkillCardMobile
											key={skill.id}
											skill={skill}
											language={i18n.language}
											onAdd={handleAdd}
											onOpenDetail={handleOpenDetail}
										/>
									))}
								</div>
							)}

							{skillsStore.loadingMoreError ? (
								<div className="flex items-center justify-center gap-2 py-2 text-xs text-destructive">
									<span>{t("skillsLibrary.loadFailed")}</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2"
										onClick={handleAutoLoadMore}
									>
										{t("skillsLibrary.retrySkills")}
									</Button>
								</div>
							) : null}

							{skillsStore.list.length > 0 ? (
								<InfiniteScroll
									hasMore={skillsStore.hasMore}
									loadMore={() => skillsStore.loadMore()}
								/>
							) : null}
						</div>
					</ScrollArea>
				</>
			) : (
				<div
					className="flex min-h-96 flex-1 items-center justify-center"
					data-testid="connector-market-mobile-page"
				/>
			)}
		</div>
	)
}

export default observer(SkillsLibraryMobile)
