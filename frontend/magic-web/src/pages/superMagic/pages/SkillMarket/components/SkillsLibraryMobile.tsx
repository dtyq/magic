import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronLeft, Loader2, Search } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn-ui/sheet"
import { Skills } from "@/enhance/lucide-react"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { StoreSkillCardMobile } from "./StoreSkillCardMobile"
import { StoreSkillsStore } from "../stores/store-skills"
import { ViewTransitionPresets } from "@/types/viewTransition"

function SkillsLibraryMobile() {
	const { t, i18n } = useTranslation("crew/market")
	const navigate = useNavigate()
	const skillsStoreRef = useRef(new StoreSkillsStore())
	const skillsStore = skillsStoreRef.current
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)

	const [searchOpen, setSearchOpen] = useState(false)
	const [queryDraft, setQueryDraft] = useState("")

	useEffect(() => {
		void skillsStore.fetchSkills()
		return () => skillsStore.reset()
	}, [skillsStore])
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

	function handleSearchOpenChange(open: boolean) {
		setSearchOpen(open)
		if (open) setQueryDraft(skillsStore.keyword)
	}

	function handleApplySearch() {
		void skillsStore.fetchSkills({ keyword: queryDraft.trim(), page: 1 })
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

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-t-0 border-border bg-background shadow-xs"
			data-testid="skills-library-mobile-page"
		>
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
				<h1 className="min-w-0 flex-1 truncate text-left text-base font-medium leading-6 text-foreground">
					{t("tabs.skillsLibrary")}
				</h1>
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
				className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block"
				viewportRef={scrollViewportRef}
			>
				<div className="flex min-w-0 flex-col gap-2.5 px-2 pb-6 pt-2">
					{skillsStore.loading && skillsStore.list.length === 0 ? (
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
							{skillsStore.keyword ? t("noResults") : t("skillsLibrary.noMoreData")}
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
									onUpgrade={handleUpgrade}
								/>
							))}
						</div>
					)}

					<div
						ref={sentinelRef}
						className="h-1 w-full"
						data-testid="skills-library-mobile-scroll-sentinel"
					/>

					{shouldShowLoadingMoreIndicator ? (
						<div
							className="flex items-center justify-center py-2"
							data-testid="skills-library-mobile-loading-more"
						>
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : null}

					{!skillsStore.hasMore && skillsStore.list.length > 0 ? (
						<div
							className="flex items-center justify-center gap-1 py-2 opacity-30"
							data-testid="skills-library-mobile-no-more"
						>
							<Check className="size-4" />
							<span className="text-xs">{t("skillsLibrary.noMoreData")}</span>
						</div>
					) : null}
				</div>
			</ScrollArea>
		</div>
	)
}

export default observer(SkillsLibraryMobile)
