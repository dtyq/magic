import { useEffect, useState } from "react"
import { ArrowRight, MessageSquareQuote, SearchX } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/shadcn-ui/empty"
import type { Topic } from "@/pages/superMagic/pages/Workspace/types"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { ResearchOnboardingAnchor } from "../onboarding/onboardingState"
import { countStudyGroups, filterStudies, type StudyGroupFilter } from "../services/studyFilter"
import { resolveStudyStatus } from "../services/studyStatus"
import SectionTitle from "./SectionTitle"
import StudyFilterBar from "./StudyFilterBar"
import StudyListItem from "./StudyListItem"

/** Below this many studies the list is short enough to scan, so search and filter stay hidden. */
const FILTER_MIN_STUDIES = 4
/** The home shows the latest few; "view all" opens the full list page. */
const HOME_LIMIT = 8
/** The full list grows by this many rows per "show more", so a long history renders in steps. */
const PAGE_SIZE = 20

interface StudyListSectionProps {
	onOpen: (topic: Topic) => void
	onDelete: (topic: Topic) => void
	onTrySample: () => void
	/**
	 * "home": titled section with the latest HOME_LIMIT studies and a link to the rest.
	 * "page": the full list page, whose own bar carries the title; rows come PAGE_SIZE at a time.
	 */
	variant?: "home" | "page"
	onViewAll?: () => void
	/** Off on phones' home, where a pinned section bar takes over and a jump needs a free heading. */
	stickyHeader?: boolean
}

/**
 * "My studies": status filter, title search, then the list. The heading row sticks to the top
 * of the scrolling page so filter and search stay in reach; every study.json is already loaded
 * for status and titles, so neither the cap nor the full page reads more files.
 */
function StudyListSection({
	onOpen,
	onDelete,
	onTrySample,
	variant = "home",
	onViewAll,
	stickyHeader = true,
}: StudyListSectionProps) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const [group, setGroup] = useState<StudyGroupFilter>("all")
	const [keyword, setKeyword] = useState("")

	const studies = store.studies
	const items = studies.map((topic) => ({
		item: topic,
		title: store.studyTitleOf(topic),
		kind: resolveStudyStatus(topic, store.studyFileOf(topic)).kind,
	}))
	const showFilter = studies.length >= FILTER_MIN_STUDIES
	// Filters stay out of play while hidden, so a short list never looks oddly empty.
	const visible = showFilter ? filterStudies(items, group, keyword) : studies
	const isFiltering = showFilter && (group !== "all" || keyword.trim() !== "")
	const clearFilter = () => {
		setGroup("all")
		setKeyword("")
	}
	// Home: the latest few unless a filter is on (then every match). Page: one step at a time.
	const [pageCount, setPageCount] = useState(PAGE_SIZE)
	useEffect(() => setPageCount(PAGE_SIZE), [group, keyword])
	const limit = variant === "page" ? pageCount : isFiltering ? Infinity : HOME_LIMIT
	const shown = visible.slice(0, limit)
	const hiddenCount = visible.length - shown.length

	return (
		<section className="flex flex-col">
			{/* The onboarding frames the heading row only: the list can be taller than the window,
			    which would leave no room for the step card beside it. */}
			<div
				className={cn(
					// Sticks under the top of the scroll area; the translucent fill and hairline keep
					// rows readable as they pass beneath it.
					"-mx-2 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/90 px-2 py-3 backdrop-blur",
					stickyHeader && "sticky top-0 z-10",
					variant === "page" && "justify-end",
				)}
				data-pin-id={variant === "home" ? "studies" : undefined}
				data-guide-anchor={
					variant === "home" ? ResearchOnboardingAnchor.HomeStudies : undefined
				}
			>
				{variant === "page" ? null : (
					<SectionTitle
						title={t("home.myStudies")}
						hint={
							studies.length === 0
								? undefined
								: isFiltering
									? t("home.filter.count", {
											shown: visible.length,
											total: studies.length,
										})
									: t("home.studiesCount", { count: studies.length })
						}
					/>
				)}
				{showFilter ? (
					<StudyFilterBar
						group={group}
						onGroupChange={setGroup}
						counts={countStudyGroups(items.map(({ kind }) => kind))}
						total={studies.length}
						keyword={keyword}
						onKeywordChange={setKeyword}
						className="max-sm:w-full"
					/>
				) : null}
			</div>
			{studies.length === 0 ? (
				<Empty className="mt-4 rounded-xl border border-dashed border-border py-10">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MessageSquareQuote />
						</EmptyMedia>
						<EmptyTitle>{t("home.emptyTitle")}</EmptyTitle>
						<EmptyDescription>{t("home.noStudies")}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button variant="outline" size="sm" onClick={onTrySample}>
							{t("home.trySample")}
						</Button>
					</EmptyContent>
				</Empty>
			) : visible.length === 0 ? (
				<Empty className="mt-4 rounded-xl border border-dashed border-border py-10">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<SearchX />
						</EmptyMedia>
						<EmptyTitle>{t("home.filter.noMatchTitle")}</EmptyTitle>
						<EmptyDescription>{t("home.filter.noMatch")}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button variant="outline" size="sm" onClick={clearFilter}>
							{t("home.filter.reset")}
						</Button>
					</EmptyContent>
				</Empty>
			) : (
				// The sticky heading's hairline is the list's top edge.
				<div className="flex flex-col">
					<ul className="flex flex-col divide-y divide-border border-b border-border">
						{shown.map((topic) => (
							<StudyListItem
								key={topic.id}
								topic={topic}
								onOpen={onOpen}
								onDelete={onDelete}
							/>
						))}
					</ul>
					{hiddenCount > 0 ? (
						<Button
							variant="ghost"
							size="sm"
							className="mt-2 gap-1.5 self-center text-muted-foreground"
							onClick={() =>
								variant === "page"
									? setPageCount((count) => count + PAGE_SIZE)
									: onViewAll?.()
							}
						>
							{variant === "page"
								? t("studies.showMore", { count: Math.min(hiddenCount, PAGE_SIZE) })
								: t("home.viewAllStudies", { count: studies.length })}
							{variant === "page" ? null : <ArrowRight className="size-3.5" />}
						</Button>
					) : null}
				</div>
			)}
		</section>
	)
}

export default observer(StudyListSection)
