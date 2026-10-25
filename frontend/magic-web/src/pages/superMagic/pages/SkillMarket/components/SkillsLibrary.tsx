import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { useDebounce, useThrottle } from "ahooks"
import { Check, ChevronDown, Loader2, Plus } from "lucide-react"
import { reaction } from "mobx"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { Skills } from "@/enhance/lucide-react"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import { cn } from "@/utils/cn"
import { configStore } from "@/models/config"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import SkillActionDropdown from "@/pages/superMagic/components/SkillActionDropdown"
import { SkillDetailDialog } from "@/pages/superMagic/components/SkillDetailDialog"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useSkillCreateMenuItems } from "@/pages/superMagic/hooks/useSkillCreateMenuItems"
import MarketStickyHeader from "@/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader"
import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
import {
	MY_SKILLS_INITIAL_TAB_QUERY_KEY,
	MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY,
	MY_SKILLS_TAB_VALUES,
} from "@/pages/superMagic/pages/MySkillsPage/route-state"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import type { StoreSkillView } from "@/services/skills/SkillsService"
import { StoreSkillsStore } from "../stores/store-skills"
import SkillCard from "./SkillCard"
import SkillCategoryFilter from "./SkillCategoryFilter"
import SkillMarketTabs, { type SkillMarketTab } from "./SkillMarketTabs"

const SKILLS_SEARCH_DEBOUNCE_MS = 300
const SKILLS_SEARCH_THROTTLE_MS = 400

interface SkillsLibraryProps {
	hideMarketingHeadline?: boolean
	marketTabValue?: SkillMarketTab
	onMarketTabChange?: (value: SkillMarketTab) => void
	skillGridClassName?: string
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

function SkillsLibrary({
	hideMarketingHeadline = false,
	marketTabValue,
	onMarketTabChange,
	skillGridClassName,
	scrollViewportRef,
}: SkillsLibraryProps) {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const skillsStore = useMemo(() => new StoreSkillsStore(), [])
	const { isAllowed: canCreateSkill } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.SkillCreate,
	)

	const [searchQuery, setSearchQuery] = useState("")
	const [isSearchComposing, setIsSearchComposing] = useState(false)
	const lastSubmittedSearchRef = useRef<string | null>(null)
	const lastSearchEffectKeywordRef = useRef<string | null>(null)
	const initialLoadLifecycleRef = useRef({ initialized: false, generation: 0 })
	const [selectedSkill, setSelectedSkill] = useState<StoreSkillView | null>(null)
	const debouncedSearchQuery = useDebounce(searchQuery, { wait: SKILLS_SEARCH_DEBOUNCE_MS })
	const throttledSearchQuery = useThrottle(debouncedSearchQuery, {
		wait: SKILLS_SEARCH_THROTTLE_MS,
	})
	const gridClass =
		skillGridClassName ??
		"grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
	const hasActiveFilters =
		Boolean(searchQuery.trim()) ||
		Boolean(skillsStore.keyword) ||
		skillsStore.categoryIds.length > 0 ||
		skillsStore.publisherType != null ||
		skillsStore.isFeatured != null
	useEffect(() => {
		const lifecycle = initialLoadLifecycleRef.current
		const effectGeneration = ++lifecycle.generation

		if (!lifecycle.initialized) {
			lifecycle.initialized = true
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

	// Debounced search; skip while IME is composing (CJK input).
	useEffect(() => {
		if (isSearchComposing) return
		const keyword = throttledSearchQuery.trim()
		if (lastSubmittedSearchRef.current === keyword) {
			lastSubmittedSearchRef.current = null
			return
		}
		if (lastSearchEffectKeywordRef.current === keyword) return
		lastSearchEffectKeywordRef.current = keyword
		void skillsStore
			.fetchSkills({ keyword: keyword || undefined, page: 1 })
			.catch(() => undefined)
	}, [skillsStore, throttledSearchQuery, isSearchComposing])

	const handleAutoLoadMore = useCallback(() => {
		void skillsStore.loadMore().catch(() => undefined)
	}, [skillsStore])
	const sentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled: skillsStore.loading || skillsStore.loadingMore || !skillsStore.hasMore,
		onLoadMore: handleAutoLoadMore,
	})

	const handleAdd = useCallback(
		(id: string) => {
			void skillsStore.addSkill(id).catch(() => {
				toast.error(t("skillsLibrary.addFailed"))
			})
		},
		[skillsStore, t],
	)

	const handleRetrySkills = useCallback(() => {
		void skillsStore.retrySkills().catch(() => undefined)
	}, [skillsStore])

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

	function handleMySkills() {
		navigate({ name: RouteName.MySkills })
	}

	const handleSearch = useCallback(
		(query?: string) => {
			if (isSearchComposing) return
			const keyword = (query ?? searchQuery).trim()
			lastSubmittedSearchRef.current = keyword
			void skillsStore
				.fetchSkills({ keyword: keyword || undefined, page: 1 })
				.catch(() => undefined)
		},
		[isSearchComposing, searchQuery, skillsStore],
	)
	const onSearchCompositionStart = useCallback(() => setIsSearchComposing(true), [])
	const onSearchCompositionEnd = useCallback(() => setIsSearchComposing(false), [])

	const createSkillMenuItems = useSkillCreateMenuItems({
		createViaChatTestId: "skills-create-via-chat",
		importSkillTestId: "skills-import-skill",
	})
	const selectedSkillId = selectedSkill?.id
	const selectedSkillStatus = selectedSkill?.status
	const isSelectedSkillAdding = selectedSkillId
		? skillsStore.isAddingSkill(selectedSkillId)
		: false
	const detailPrimaryAction = useMemo(
		() =>
			selectedSkillId
				? {
						label: isSelectedSkillAdding
							? t("skillsLibrary.adding")
							: selectedSkillStatus === "added"
								? t("skillsLibrary.added")
								: t("skillsLibrary.addToMySkills"),
						onClick: async () => {
							if (selectedSkillStatus === "added") {
								return
							}

							await skillsStore.addSkill(selectedSkillId)
						},
						onError: () => toast.error(t("skillsLibrary.actionFailed")),
						disabled: isSelectedSkillAdding || selectedSkillStatus === "added",
						testId: "skill-detail-dialog-primary-action",
					}
				: undefined,
		[isSelectedSkillAdding, selectedSkillId, selectedSkillStatus, skillsStore, t],
	)

	return (
		<div className="flex min-w-0 flex-col pt-5 sm:pt-6" data-testid="skills-library">
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
			<header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
				{hideMarketingHeadline ? null : (
					<div className="flex min-w-0 flex-1 flex-col gap-2.5">
						{marketTabValue && onMarketTabChange ? (
							<SkillMarketTabs
								value={marketTabValue}
								onValueChange={onMarketTabChange}
							/>
						) : (
							<h1 className="break-words bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-2xl font-bold leading-tight tracking-[-0.035em] text-transparent sm:text-3xl lg:text-4xl">
								{t("skillsLibrary.title")}
							</h1>
						)}
						<p className="max-w-2xl break-words text-sm text-muted-foreground">
							{t("skillsLibrary.subtitle")}
						</p>
					</div>
				)}

				<div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
					<Button
						variant="outline"
						className="h-9 flex-1 gap-2 bg-background shadow-xs sm:flex-none"
						onClick={handleMySkills}
						data-guide-anchor={HomeOnboardingAnchor.SkillMarketMySkills}
						data-testid="skills-library-my-skills-button"
					>
						<Skills className="size-4" />
						{t("skillsLibrary.mySkills")}
					</Button>

					{canCreateSkill ? (
						<SkillActionDropdown
							createMenuItems={createSkillMenuItems}
							onImportSuccess={(result) =>
								navigate({
									name: RouteName.MySkills,
									query: {
										[MY_SKILLS_INITIAL_TAB_QUERY_KEY]:
											MY_SKILLS_TAB_VALUES.createdByMe,
										[MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY]: result.skill_code,
									},
								})
							}
							promptPublishAfterImport
							placement="bottomRight"
							overlayClassName="w-80"
						>
							<span>
								<Button
									className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
									data-guide-anchor={HomeOnboardingAnchor.SkillMarketCreate}
									data-testid="skills-library-create-button"
								>
									<Plus className="size-4" />
									{t("skillsLibrary.createSkill")}
									<ChevronDown className="size-4 opacity-70" />
								</Button>
							</span>
						</SkillActionDropdown>
					) : null}
				</div>
			</header>

			<MarketStickyHeader
				className="gap-5 pb-5 pt-5 sm:gap-6 sm:pb-6 sm:pt-6"
				scrollViewportRef={scrollViewportRef}
				data-testid="skills-library-sticky-header"
			>
				{/*
				 * The onboarding tour highlights the search field as one control. The anchor wraps
				 * the bar instead of being passed into it: `SearchBar` is shared with the crew and
				 * connector markets and knows nothing about guides.
				 */}
				<div data-guide-anchor={HomeOnboardingAnchor.SkillMarketSearch}>
					<SearchBar
						value={searchQuery}
						onChange={setSearchQuery}
						onSearch={handleSearch}
						onCompositionStart={onSearchCompositionStart}
						onCompositionEnd={onSearchCompositionEnd}
						placeholder={t("skillsLibrary.aiSearchPlaceholder")}
						enableSearchSubmit
						data-testid="skills-library-search-bar"
					/>
				</div>
				<SkillCategoryFilter
					categories={skillsStore.categories}
					selectedCategoryIds={skillsStore.categoryIds}
					selectedIsFeatured={skillsStore.isFeatured}
					loading={skillsStore.categoriesLoading}
					error={skillsStore.categoriesError}
					onChange={handleCategoryChange}
				/>
			</MarketStickyHeader>

			<div className="flex min-w-0 flex-col gap-5 pb-5 sm:gap-6 sm:pb-6">
				<section className="flex min-w-0 flex-col" data-testid="all-skills-section">
					{skillsStore.listError ? (
						<div
							className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground"
							data-testid="skills-library-error"
						>
							<span>{t("skillsLibrary.loadFailed")}</span>
							<Button variant="outline" size="sm" onClick={handleRetrySkills}>
								{t("skillsLibrary.retrySkills")}
							</Button>
						</div>
					) : skillsStore.loading && skillsStore.list.length === 0 ? (
						<div
							className="flex items-center justify-center py-16"
							data-testid="skills-library-loading"
						>
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : skillsStore.isEmpty ? (
						<div
							className="flex items-center justify-center py-16 text-sm text-muted-foreground"
							data-testid="skills-library-empty"
						>
							{hasActiveFilters ? t("noResults") : t("skillsLibrary.noMoreData")}
						</div>
					) : (
						<div className={cn(gridClass, "mt-4")} data-testid="skill-card-grid">
							{skillsStore.list.map((skill) => (
								<SkillCard
									key={skill.id}
									skill={skill}
									isAdding={skillsStore.isAddingSkill(skill.id)}
									onAdd={handleAdd}
									onOpenDetail={() => handleOpenDetail(skill)}
								/>
							))}
						</div>
					)}
				</section>

				{skillsStore.list.length > 0 ? (
					<div
						ref={sentinelRef}
						className="h-1 w-full"
						data-testid="skills-library-scroll-sentinel"
					/>
				) : null}

				{skillsStore.list.length > 0 ? (
					<div className="flex items-center justify-center py-2">
						{skillsStore.loadingMoreError ? (
							<div className="flex items-center justify-center gap-2 text-xs text-destructive">
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
						) : skillsStore.hasMore ? (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleAutoLoadMore}
								disabled={skillsStore.loadingMore}
								data-testid="skills-library-load-more"
							>
								{skillsStore.loadingMore ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : null}
								{skillsStore.loadingMore ? t("loadingMore") : t("loadMore")}
							</Button>
						) : (
							<div
								className="flex items-center justify-center gap-1 opacity-30"
								data-testid="skills-library-no-more"
							>
								<Check className="size-4" />
								<span className="text-xs">{t("noMoreData")}</span>
							</div>
						)}
					</div>
				) : null}
			</div>
		</div>
	)
}

export default observer(SkillsLibrary)
