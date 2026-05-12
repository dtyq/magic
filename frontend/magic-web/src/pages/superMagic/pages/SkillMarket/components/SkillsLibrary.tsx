import { useCallback, useMemo, useEffect, useState } from "react"
import type { RefObject } from "react"
import { reaction } from "mobx"
import { configStore } from "@/models/config"
import { useDebounce, useThrottle } from "ahooks"
import { CirclePlus, ChevronDown, Check, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { FUNCTION_PERMISSION_CODE } from "@/apis"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"
import SkillActionDropdown from "@/pages/superMagic/components/SkillActionDropdown"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useSkillCreateMenuItems } from "@/pages/superMagic/hooks/useSkillCreateMenuItems"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
import { SkillDetailDialog } from "@/pages/superMagic/components/SkillDetailDialog"
import {
	MY_SKILLS_TAB_VALUES,
	MY_SKILLS_INITIAL_TAB_QUERY_KEY,
	MY_SKILLS_PUBLISH_SKILL_CODE_QUERY_KEY,
} from "@/pages/superMagic/pages/MySkillsPage/route-state"
import SkillCard, { type SkillCardData } from "./SkillCard"
import { StoreSkillsStore } from "../stores/store-skills"
import { Skills } from "@/enhance/lucide-react"
import type { StoreSkillView } from "@/services/skills/SkillsService"

const SKILLS_SEARCH_DEBOUNCE_MS = 300
const SKILLS_SEARCH_THROTTLE_MS = 400

interface SkillsLibraryProps {
	hideMarketingHeadline?: boolean
	skillGridClassName?: string
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

function SkillsLibrary({
	hideMarketingHeadline = false,
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
	const [selectedSkill, setSelectedSkill] = useState<StoreSkillView | null>(null)
	const debouncedSearchQuery = useDebounce(searchQuery, { wait: SKILLS_SEARCH_DEBOUNCE_MS })
	const throttledSearchQuery = useThrottle(debouncedSearchQuery, {
		wait: SKILLS_SEARCH_THROTTLE_MS,
	})

	useEffect(() => () => skillsStore.reset(), [skillsStore])

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
		const kw = throttledSearchQuery.trim()
		void skillsStore.fetchSkills({ keyword: kw || undefined, page: 1 })
	}, [skillsStore, throttledSearchQuery, isSearchComposing])
	const handleAutoLoadMore = useCallback(() => {
		void skillsStore.loadMore()
	}, [skillsStore])
	const sentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled: skillsStore.loading || skillsStore.loadingMore || !skillsStore.hasMore,
		onLoadMore: handleAutoLoadMore,
	})
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: skillsStore.loadingMore,
	})

	const handleAdd = useCallback(
		(id: string) => {
			void skillsStore.addSkill(id)
		},
		[skillsStore],
	)

	const handleUpgrade = useCallback(
		(id: string) => {
			void skillsStore.upgradeSkill(id)
		},
		[skillsStore],
	)

	const handleOpenDetail = useCallback(
		(skill: SkillCardData) => {
			const fromStore = skillsStore.list.find((s) => s.id === skill.id)
			if (fromStore) setSelectedSkill(fromStore)
		},
		[skillsStore],
	)

	const handleSearch = useCallback(() => {
		if (isSearchComposing) return
		const keyword = searchQuery.trim()
		void skillsStore.fetchSkills({ keyword: keyword || undefined, page: 1 })
	}, [isSearchComposing, searchQuery, skillsStore])

	const onSearchCompositionStart = useCallback(() => setIsSearchComposing(true), [])
	const onSearchCompositionEnd = useCallback(() => setIsSearchComposing(false), [])

	function handleMySkills() {
		navigate({ name: RouteName.MySkills })
	}

	const createSkillMenuItems = useSkillCreateMenuItems({
		createViaChatTestId: "skills-create-via-chat",
		importSkillTestId: "skills-import-skill",
	})

	const gridClass = skillGridClassName ?? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"

	return (
		<div
			className="mt-5 flex min-w-0 flex-col gap-6 sm:mt-8 sm:gap-8"
			data-testid="skills-library"
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
				primaryAction={
					selectedSkill
						? {
								label:
									selectedSkill.status === "added"
										? selectedSkill.needUpgrade
											? t("skillsLibrary.upgrade")
											: t("skillsLibrary.added")
										: t("skillsLibrary.addToMySkills"),
								onClick: async () => {
									if (selectedSkill.status === "added") {
										if (selectedSkill.needUpgrade)
											await skillsStore.upgradeSkill(selectedSkill.id)
										return
									}

									await skillsStore.addSkill(selectedSkill.id)
								},
								disabled:
									selectedSkill.status === "added" && !selectedSkill.needUpgrade,
								testId: "skill-detail-dialog-primary-action",
							}
						: undefined
				}
			/>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				{hideMarketingHeadline ? null : (
					<div className="flex min-w-0 flex-1 flex-col gap-2.5">
						<h1 className="break-words bg-gradient-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-2xl font-bold leading-tight text-transparent sm:text-3xl lg:text-4xl">
							{t("skillsLibrary.title")}
						</h1>
						<p className="max-w-2xl break-words text-sm text-muted-foreground">
							{t("skillsLibrary.subtitle")}
						</p>
					</div>
				)}
				<div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
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
									data-testid="skills-library-create-button"
								>
									<CirclePlus className="h-4 w-4" />
									{t("skillsLibrary.createSkill")}
									<ChevronDown className="h-4 w-4" />
								</Button>
							</span>
						</SkillActionDropdown>
					) : null}
					<Button
						variant="outline"
						className="h-9 flex-1 gap-2 bg-background shadow-xs sm:flex-none"
						onClick={handleMySkills}
						data-testid="skills-library-my-skills-button"
					>
						<Skills className="h-4 w-4" />
						{t("skillsLibrary.mySkills")}
					</Button>
				</div>
			</div>

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

			{skillsStore.loading && skillsStore.list.length === 0 ? (
				<div
					className="flex items-center justify-center py-8"
					data-testid="skills-library-loading"
				>
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : skillsStore.isEmpty ? (
				<div
					className="flex items-center justify-center py-8 text-sm text-muted-foreground"
					data-testid="skills-library-empty"
				>
					{skillsStore.keyword ? t("noResults") : t("skillsLibrary.noMoreData")}
				</div>
			) : (
				<div className={gridClass} data-testid="skill-card-grid">
					{skillsStore.list.map((skill) => (
						<SkillCard
							key={skill.id}
							skill={skill}
							onAdd={handleAdd}
							onUpgrade={handleUpgrade}
							onOpenDetail={handleOpenDetail}
						/>
					))}
				</div>
			)}

			<div
				ref={sentinelRef}
				className="h-1 w-full"
				data-testid="skills-library-scroll-sentinel"
			/>

			{shouldShowLoadingMoreIndicator ? (
				<div
					className="flex items-center justify-center py-2"
					data-testid="skills-library-loading-more"
				>
					<Loader2 className="size-4 animate-spin text-muted-foreground" />
				</div>
			) : null}

			{!skillsStore.hasMore && skillsStore.list.length > 0 ? (
				<div
					className="flex items-center justify-center gap-1 py-2 opacity-30"
					data-testid="skills-library-no-more"
				>
					<Check className="size-4" />
					<span className="text-xs">{t("skillsLibrary.noMoreData")}</span>
				</div>
			) : null}
		</div>
	)
}

export default observer(SkillsLibrary)
