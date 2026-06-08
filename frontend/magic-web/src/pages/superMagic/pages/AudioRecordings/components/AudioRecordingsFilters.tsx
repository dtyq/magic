import { useMemo } from "react"
import { ArrowDownUp, CalendarRange, Check, ChevronDown, RefreshCw, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/lib/utils"
import type {
	AudioProjectSortBy,
	AudioProjectSortOrder,
	AudioRecordingSummaryFilter,
} from "@/types/audioProject"
import { toEndOfDayTimestamp, toStartOfDayTimestamp } from "../utils/audio-recordings-utils"

export type AudioRecordingsDatePreset = "all" | "last7" | "last30" | "last90"

type AudioRecordingsSortOption = `${AudioProjectSortBy}_${AudioProjectSortOrder}`

interface AudioRecordingsFiltersProps {
	listCount: number
	summaryFilter: AudioRecordingSummaryFilter
	datePreset: AudioRecordingsDatePreset
	sortBy: AudioProjectSortBy
	sortOrder: AudioProjectSortOrder
	searchKeyword: string
	isRefreshing: boolean
	onSummaryFilterChange: (value: AudioRecordingSummaryFilter) => void
	onDatePresetChange: (value: AudioRecordingsDatePreset) => void
	onSortByChange: (value: AudioProjectSortBy) => void
	onSortOrderChange: (value: AudioProjectSortOrder) => void
	onSearchKeywordChange: (value: string) => void
	onSearchCompositionStart: () => void
	onSearchCompositionEnd: () => void
	onRefresh: () => void
}

/** Resolves date preset into unix second range for API filters */
export function resolveDatePresetRange(preset: AudioRecordingsDatePreset): {
	start?: number
	end?: number
} {
	if (preset === "all") return {}

	const now = new Date()
	const end = toEndOfDayTimestamp(now)
	const startDate = new Date(now)

	if (preset === "last7") startDate.setDate(startDate.getDate() - 6)
	if (preset === "last30") startDate.setDate(startDate.getDate() - 29)
	if (preset === "last90") startDate.setDate(startDate.getDate() - 89)

	return {
		start: toStartOfDayTimestamp(startDate),
		end,
	}
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
	// Sort keys use snake_case fields (e.g. updated_at_desc), so split from the last segment
	const separatorIndex = option.lastIndexOf("_")
	const sortBy = option.slice(0, separatorIndex) as AudioProjectSortBy
	const sortOrder = option.slice(separatorIndex + 1) as AudioProjectSortOrder
	return { sortBy, sortOrder }
}

/** Renders summary filter label with optional count badge for trigger and menu rows */
function SummaryOptionLabel({
	label,
	count,
	variant,
}: {
	label: string
	count?: number
	variant: "trigger" | "menu"
}) {
	if (variant === "trigger") {
		return (
			<span className="flex items-baseline gap-1.5 text-lg font-medium text-foreground">
				<span>{label}</span>
				{count != null ? (
					<span className="-ml-1.5" data-testid="audio-recordings-summary-filter-count">
						（{count}）
					</span>
				) : null}
			</span>
		)
	}

	return (
		<span className="flex min-w-0 flex-1 items-center gap-1.5">
			<span>{label}</span>
			{count != null ? <span className="text-xs text-muted-foreground">{count}</span> : null}
		</span>
	)
}

/** Summary status dropdown using the same trigger pattern as DatePresetFilter */
function SummaryStatusFilter({
	listCount,
	summaryFilter,
	onSummaryFilterChange,
}: {
	listCount: number
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
					className="flex h-8 items-center gap-1 rounded-lg px-1 transition-colors hover:bg-muted"
					data-testid="audio-recordings-summary-filter"
				>
					<SummaryOptionLabel label={activeLabel} count={listCount} variant="trigger" />
					<ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-[168px]">
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

/** Date preset dropdown styled like shared workspace filter controls */
function DatePresetFilter({
	datePreset,
	onDatePresetChange,
}: {
	datePreset: AudioRecordingsDatePreset
	onDatePresetChange: (value: AudioRecordingsDatePreset) => void
}) {
	const { t } = useTranslation("audioRecordings")

	const dateOptions = useMemo(
		() =>
			[
				{ value: "all", label: t("filters.dateAll") },
				{ value: "last7", label: t("filters.dateLast7Days") },
				{ value: "last30", label: t("filters.dateLast30Days") },
				{ value: "last90", label: t("filters.dateLast90Days") },
			] as const,
		[t],
	)

	const activeLabel =
		dateOptions.find((option) => option.value === datePreset)?.label ?? t("filters.dateAll")

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex h-8 items-center gap-1 rounded-lg px-2.5 transition-colors hover:bg-muted"
					data-testid="audio-recordings-date-filter"
				>
					<CalendarRange className="h-4 w-4 text-muted-foreground" />
					<span className="text-xs text-muted-foreground">{t("filters.dateRange")}</span>
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

	// Only expose descending sort: newest first for updated/created time
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

/** Single-row filter bar: summary on the left; date, sort, search, and refresh on the right */
function AudioRecordingsFilters({
	listCount,
	summaryFilter,
	datePreset,
	sortBy,
	sortOrder,
	searchKeyword,
	isRefreshing,
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
				<SummaryStatusFilter
					listCount={listCount}
					summaryFilter={summaryFilter}
					onSummaryFilterChange={onSummaryFilterChange}
				/>
				<div className="flex flex-wrap items-center gap-1.5">
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
					<RefreshButton isRefreshing={isRefreshing} onRefresh={onRefresh} />
				</div>
			</div>
		</div>
	)
}

export default AudioRecordingsFilters
