import { useMemo } from "react"
import {
	ArrowDownUp,
	CalendarRange,
	Check,
	ChevronDown,
	FolderClosed,
	RefreshCw,
	Search,
	X,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { cn } from "@/utils/cn"
import type {
	AudioProjectSortBy,
	AudioProjectSortOrder,
	AudioRecordingSummaryFilter,
} from "@/types/audioProject"
import type { AudioRecordingsDatePreset } from "../utils/resolve-date-preset-range"
import {
	ALL_RECORDING_GROUP_ID,
	UNGROUPED_RECORDING_GROUP_ID,
} from "@/services/audioRecordings/RecordingGroupsConstants"
import { resolveRecordingGroupDisplayName } from "@/services/audioRecordings/resolveRecordingGroupDisplayName"

export type { AudioRecordingsDatePreset } from "../utils/resolve-date-preset-range"

type AudioRecordingsSortOption = `${AudioProjectSortBy}_${AudioProjectSortOrder}`

interface AudioRecordingGroup {
	id: string
	name: string
	projectCount: number
	isVirtual: boolean
}

interface AudioRecordingsFiltersProps {
	listCount: number
	summaryFilter: AudioRecordingSummaryFilter
	datePreset: AudioRecordingsDatePreset
	sortBy: AudioProjectSortBy
	sortOrder: AudioProjectSortOrder
	searchKeyword: string
	isRefreshing: boolean
	// Group props
	groups: AudioRecordingGroup[]
	totalGroupCount: number
	ungroupedCount: number
	currentGroupId: string
	onGroupChange: (groupId: string) => void
	onManageGroups: () => void
	// Other actions
	onSummaryFilterChange: (value: AudioRecordingSummaryFilter) => void
	onDatePresetChange: (value: AudioRecordingsDatePreset) => void
	onSortByChange: (value: AudioProjectSortBy) => void
	onSortOrderChange: (value: AudioProjectSortOrder) => void
	onSearchKeywordChange: (value: string) => void
	onSearchCompositionStart: () => void
	onSearchCompositionEnd: () => void
	onRefresh: () => void
}

/** Builds a stable sort option key from field and direction */
function toSortOption(
	sortBy: AudioProjectSortBy,
	sortOrder: AudioProjectSortOrder,
): AudioRecordingsSortOption {
	return `${sortBy}_${sortOrder}`
}

/** Parses a sort option key back into API sort params */
function fromSortOption(option: AudioRecordingsSortOption): {
	sortBy: AudioProjectSortBy
	sortOrder: AudioProjectSortOrder
} {
	const separatorIndex = option.lastIndexOf("_")
	const sortBy = option.slice(0, separatorIndex) as AudioProjectSortBy
	const sortOrder = option.slice(separatorIndex + 1) as AudioProjectSortOrder
	return { sortBy, sortOrder }
}

/** Group selection filter rendering custom folders list and manage entry */
function AudioRecordingGroupFilter({
	groups = [],
	totalGroupCount = 0,
	ungroupedCount = 0,
	currentGroupId = ALL_RECORDING_GROUP_ID,
	onGroupChange,
	onManageGroups,
}: {
	groups: AudioRecordingGroup[]
	totalGroupCount: number
	ungroupedCount: number
	currentGroupId: string
	onGroupChange: (groupId: string) => void
	onManageGroups: () => void
}) {
	const { t } = useTranslation(["super", "audioRecordings"])
	const unnamedGroupLabel = t("super:mobile.recordingEntry.groupSheet.unnamedGroup")

	const currentLabel = useMemo(() => {
		if (currentGroupId === ALL_RECORDING_GROUP_ID) {
			return `${t("super:mobile.recordingEntry.groupSheet.all")}（${totalGroupCount}）`
		}
		if (currentGroupId === UNGROUPED_RECORDING_GROUP_ID) {
			return `${t("super:mobile.recordingEntry.groupSheet.ungrouped")}（${ungroupedCount}）`
		}
		const matched = groups?.find((g) => g.id === currentGroupId)
		const groupName = resolveRecordingGroupDisplayName(matched?.name, unnamedGroupLabel)
		// Fall back visually while the page layer clears stale persisted group ids after metadata loads.
		return matched
			? `${groupName}（${matched.projectCount}）`
			: `${t("super:mobile.recordingEntry.groupSheet.all")}（${totalGroupCount}）`
	}, [currentGroupId, groups, totalGroupCount, ungroupedCount, unnamedGroupLabel, t])

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex h-8 items-center gap-1 rounded-lg px-2 transition-colors hover:bg-muted/80 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:outline-none data-[state=open]:ring-0"
					data-testid="audio-recordings-group-filter-trigger"
				>
					<span className="max-w-[280px] truncate text-lg font-medium text-foreground">
						{currentLabel}
					</span>
					<ChevronDown className="h-4 w-4 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="max-h-[360px] w-max min-w-[240px] max-w-[320px] overflow-hidden"
			>
				{/* Reserve space for group management outside the bounded options viewport. */}
				<ScrollArea viewportClassName="h-auto max-h-[min(312px,calc(var(--radix-dropdown-menu-content-available-height)-48px))] [&>div]:!block">
					{/* Match the standard filter dropdown color while keeping regular item weight. */}
					<DropdownMenuItem
						onClick={() => onGroupChange(ALL_RECORDING_GROUP_ID)}
						className="flex items-center justify-between gap-3 font-normal"
						data-testid="audio-recordings-group-all"
					>
						<span>{t("super:mobile.recordingEntry.groupSheet.all")}</span>
						<span className="text-xs tabular-nums text-muted-foreground">
							{totalGroupCount}
						</span>
					</DropdownMenuItem>

					{/* Virtual Item: Ungrouped */}
					<DropdownMenuItem
						onClick={() => onGroupChange(UNGROUPED_RECORDING_GROUP_ID)}
						className="flex items-center justify-between gap-3 font-normal"
						data-testid="audio-recordings-group-ungrouped"
					>
						<span>{t("super:mobile.recordingEntry.groupSheet.ungrouped")}</span>
						<span className="text-xs tabular-nums text-muted-foreground">
							{ungroupedCount}
						</span>
					</DropdownMenuItem>

					{/* Custom folder items */}
					{groups.map((group) => (
						<DropdownMenuItem
							key={group.id}
							onClick={() => onGroupChange(group.id)}
							className="flex items-center justify-between gap-3 font-normal"
							data-testid={`audio-recordings-group-custom-${group.id}`}
						>
							<span className="min-w-0 flex-1 truncate">
								{resolveRecordingGroupDisplayName(group.name, unnamedGroupLabel)}
							</span>
							<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
								{group.projectCount}
							</span>
						</DropdownMenuItem>
					))}
				</ScrollArea>
				<DropdownMenuSeparator />

				{/* Manage Action Trigger */}
				<DropdownMenuItem
					onClick={(e) => {
						e.stopPropagation()
						onManageGroups()
					}}
					className="flex items-center gap-2 font-medium"
					data-testid="audio-recordings-group-manage-trigger"
				>
					<FolderClosed className="h-4 w-4" />
					<span>{t("super:mobile.recordingEntry.groupSheet.manageGroups")}</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Summary status filter dropdown positioned on right filter-bar area */
function SummaryStatusFilter({
	summaryFilter,
	onSummaryFilterChange,
}: {
	summaryFilter: AudioRecordingSummaryFilter
	onSummaryFilterChange: (value: AudioRecordingSummaryFilter) => void
}) {
	const { t } = useTranslation("audioRecordings")

	const summaryOptions = useMemo(
		() =>
			[
				{ value: "all", label: t("filters.summaryAll") },
				{ value: "not_summarized", label: t("filters.summaryNotDone") },
				{ value: "summarized", label: t("filters.summaryDone") },
			] as const,
		[t],
	)

	const activeLabel =
		summaryOptions.find((option) => option.value === summaryFilter)?.label ??
		t("filters.summaryAll")

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex h-8 items-center gap-1 rounded-lg px-2.5 transition-colors hover:bg-muted"
					data-testid="audio-recordings-summary-filter"
				>
					<span className="text-xs text-muted-foreground">
						{t("filters.summaryStatus")}
					</span>
					<span className="text-xs text-foreground">{activeLabel}</span>
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[150px]">
				{summaryOptions.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => onSummaryFilterChange(option.value)}
						className="flex items-center justify-between gap-2"
						data-testid={`audio-recordings-summary-${option.value}`}
					>
						<span>{option.label}</span>
						{summaryFilter === option.value ? (
							<Check className="h-4 w-4 text-primary" />
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Mobile-aligned date presets shared across PC and H5 recording list filters */
const DATE_PRESETS: AudioRecordingsDatePreset[] = ["all", "today", "week", "month"]

/** Resolves each supported date preset to a literal i18n key for static locale analysis */
function resolveDatePresetLabel(
	preset: AudioRecordingsDatePreset,
	t: (key: string) => string,
): string {
	if (preset === "all") return t("super:mobile.recordingEntry.filterSheet.dateRange.all")
	if (preset === "today") return t("super:mobile.recordingEntry.filterSheet.dateRange.today")
	if (preset === "week") return t("super:mobile.recordingEntry.filterSheet.dateRange.week")
	return t("super:mobile.recordingEntry.filterSheet.dateRange.month")
}

/** Date preset dropdown styled like shared workspace filter controls */
function DatePresetFilter({
	datePreset,
	onDatePresetChange,
}: {
	datePreset: AudioRecordingsDatePreset
	onDatePresetChange: (value: AudioRecordingsDatePreset) => void
}) {
	const { t } = useTranslation(["audioRecordings", "super"])

	const dateOptions = useMemo(
		() =>
			DATE_PRESETS.map((value) => ({
				value,
				label: resolveDatePresetLabel(value, t),
			})),
		[t],
	)

	const activeLabel = resolveDatePresetLabel(datePreset, t)

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex h-8 items-center gap-1 rounded-lg px-2.5 transition-colors hover:bg-muted"
					data-testid="audio-recordings-date-filter"
				>
					<CalendarRange className="h-4 w-4 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">
						{t("super:mobile.recordingEntry.filterSheet.dateRange.label")}
					</span>
					<span className="text-xs text-foreground">{activeLabel}</span>
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[168px]">
				{dateOptions.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => onDatePresetChange(option.value)}
						className="flex items-center justify-between gap-2"
						data-testid={`audio-recordings-date-${option.value}`}
					>
						<span>{option.label}</span>
						{datePreset === option.value ? (
							<Check className="h-4 w-4 text-primary" />
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Combined sort dropdown aligned with shared workspace SortSelector */
function SortFilter({
	sortBy,
	sortOrder,
	onSortByChange,
	onSortOrderChange,
}: {
	sortBy: AudioProjectSortBy
	sortOrder: AudioProjectSortOrder
	onSortByChange: (value: AudioProjectSortBy) => void
	onSortOrderChange: (value: AudioProjectSortOrder) => void
}) {
	const { t } = useTranslation("audioRecordings")
	const activeOption = toSortOption(sortBy, sortOrder)

	const sortOptions = useMemo(
		() =>
			[
				{
					value: "updated_at_desc" as const,
					label: t("filters.sortByUpdatedDesc"),
				},
				{
					value: "created_at_desc" as const,
					label: t("filters.sortByCreatedDesc"),
				},
			] as const,
		[t],
	)

	const activeLabel =
		sortOptions.find((option) => option.value === activeOption)?.label ??
		t("filters.sortByUpdatedDesc")

	function handleSortChange(option: AudioRecordingsSortOption) {
		const next = fromSortOption(option)
		onSortByChange(next.sortBy)
		onSortOrderChange(next.sortOrder)
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex h-8 items-center gap-1 rounded-lg px-2.5 transition-colors hover:bg-muted"
					data-testid="audio-recordings-sort-filter"
				>
					<ArrowDownUp className="h-4 w-4 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">{t("filters.sort")}</span>
					<span className="max-w-[140px] truncate text-xs text-foreground">
						{activeLabel}
					</span>
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[200px]">
				{sortOptions.map((option) => (
					<DropdownMenuItem
						key={option.value}
						onClick={() => handleSortChange(option.value)}
						className="flex items-center justify-between gap-2"
					>
						<span>{option.label}</span>
						{activeOption === option.value ? (
							<Check className="h-4 w-4 text-primary" />
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Compact search input aligned with filter bar control height */
function SearchInput({
	searchKeyword,
	onSearchKeywordChange,
	onSearchCompositionStart,
	onSearchCompositionEnd,
}: {
	searchKeyword: string
	onSearchKeywordChange: (value: string) => void
	onSearchCompositionStart: () => void
	onSearchCompositionEnd: () => void
}) {
	const { t } = useTranslation("audioRecordings")

	return (
		<div className="relative w-40">
			<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={searchKeyword}
				onChange={(event) => onSearchKeywordChange(event.target.value)}
				onCompositionStart={onSearchCompositionStart}
				onCompositionEnd={onSearchCompositionEnd}
				placeholder={t("searchPlaceholder")}
				className="h-8 bg-background pl-8 pr-8 text-xs"
				data-testid="audio-recordings-search-input"
			/>
			{searchKeyword ? (
				<button
					type="button"
					className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					onClick={() => onSearchKeywordChange("")}
					aria-label={t("searchClear")}
					data-testid="audio-recordings-search-clear"
				>
					<X className="h-3 w-3" />
				</button>
			) : null}
		</div>
	)
}

/** Refresh button that spins while the list is re-fetching */
function RefreshButton({
	isRefreshing,
	onRefresh,
}: {
	isRefreshing: boolean
	onRefresh: () => void
}) {
	const { t } = useTranslation("audioRecordings")

	return (
		<Button
			type="button"
			variant="outline"
			size="icon"
			className="size-8 shrink-0 rounded-lg bg-background shadow-xs"
			data-testid="audio-recordings-refresh-button"
			aria-label={t("refresh")}
			disabled={isRefreshing}
			onClick={onRefresh}
		>
			<RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} aria-hidden />
		</Button>
	)
}

/** Query-only toolbar for desktop list filters; creation actions live in the header action cluster. */
function AudioRecordingsFilters({
	summaryFilter,
	datePreset,
	sortBy,
	sortOrder,
	searchKeyword,
	isRefreshing,
	groups,
	totalGroupCount,
	ungroupedCount,
	currentGroupId,
	onGroupChange,
	onManageGroups,
	onSummaryFilterChange,
	onDatePresetChange,
	onSortByChange,
	onSortOrderChange,
	onSearchKeywordChange,
	onSearchCompositionStart,
	onSearchCompositionEnd,
	onRefresh,
}: AudioRecordingsFiltersProps) {
	return (
		<div
			className="w-full min-w-0 rounded-lg bg-muted/50 px-4 py-2.5 dark:bg-white/5"
			data-testid="audio-recordings-filters"
		>
			<div className="flex flex-wrap items-center justify-between gap-2.5">
				{/* Left Side: Group selection */}
				<AudioRecordingGroupFilter
					groups={groups}
					totalGroupCount={totalGroupCount}
					ungroupedCount={ungroupedCount}
					currentGroupId={currentGroupId}
					onGroupChange={onGroupChange}
					onManageGroups={onManageGroups}
				/>

				{/* Right Side: Other search metadata filters and actions */}
				<div className="flex flex-wrap items-center gap-1.5">
					<SummaryStatusFilter
						summaryFilter={summaryFilter}
						onSummaryFilterChange={onSummaryFilterChange}
					/>
					<DatePresetFilter
						datePreset={datePreset}
						onDatePresetChange={onDatePresetChange}
					/>
					<SortFilter
						sortBy={sortBy}
						sortOrder={sortOrder}
						onSortByChange={onSortByChange}
						onSortOrderChange={onSortOrderChange}
					/>
					<SearchInput
						searchKeyword={searchKeyword}
						onSearchKeywordChange={onSearchKeywordChange}
						onSearchCompositionStart={onSearchCompositionStart}
						onSearchCompositionEnd={onSearchCompositionEnd}
					/>
					{/* Refresh stays inside the filter bar because it re-fetches the active query state. */}
					<RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
				</div>
			</div>
		</div>
	)
}

export default AudioRecordingsFilters
