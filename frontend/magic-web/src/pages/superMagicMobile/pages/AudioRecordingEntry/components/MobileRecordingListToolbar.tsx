import { ChevronDown, ListFilter, Search, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { cn } from "@/utils/cn"
import { resolveRecordingGroupDisplayName } from "@/services/audioRecordings/resolveRecordingGroupDisplayName"

interface MobileRecordingListToolbarProps {
	groupLabel: string
	groupCount: number
	activeFilterCount: number
	searchOpen: boolean
	searchKeyword: string
	onSearchKeywordChange: (value: string) => void
	onSearchCompositionStart?: () => void
	onSearchCompositionEnd?: () => void
	onOpenSearch: () => void
	onDismissSearch: () => void
	onOpenGroupSheet: () => void
	onOpenFilterSheet: () => void
	onOpenImportSheet: () => void
}

/**
 * Fixed h-11 toolbar row: recording group picker, upload/filter/search actions,
 * or inline search bar when search mode is active.
 */
export function MobileRecordingListToolbar({
	groupLabel,
	groupCount,
	activeFilterCount,
	searchOpen,
	searchKeyword,
	onSearchKeywordChange,
	onSearchCompositionStart,
	onSearchCompositionEnd,
	onOpenSearch,
	onDismissSearch,
	onOpenGroupSheet,
	onOpenFilterSheet,
	onOpenImportSheet,
}: MobileRecordingListToolbarProps) {
	const { t } = useTranslation(["super", "audioRecordings"])
	const unnamedGroupLabel = t("super:mobile.recordingEntry.groupSheet.unnamedGroup")
	const displayGroupLabel =
		groupLabel === "all"
			? t("super:mobile.recordingEntry.groupSheet.all")
			: groupLabel === "ungrouped"
				? t("super:mobile.recordingEntry.groupSheet.ungrouped")
				: resolveRecordingGroupDisplayName(groupLabel, unnamedGroupLabel)

	// !stroke-2 beats unlayered .lucide { stroke-width: 1.5px } from lucide.css
	const lucideStrokeClass = "[&_.lucide]:!stroke-2"

	if (searchOpen) {
		return (
			<div
				className={cn("flex h-11 shrink-0 items-center", lucideStrokeClass)}
				data-testid="mobile-recording-toolbar-search"
			>
				<MobileBottomSearchBar
					layout="inline"
					value={searchKeyword}
					onValueChange={onSearchKeywordChange}
					onCompositionStart={onSearchCompositionStart}
					onCompositionEnd={onSearchCompositionEnd}
					placeholder={t("audioRecordings:searchPlaceholder")}
					clearAriaLabel={t("super:mobile.recordingEntry.toolbar.clearSearchAria")}
					testIdPrefix="mobile-recording-search"
					onDismiss={onDismissSearch}
					autoFocus
					className="w-full"
				/>
			</div>
		)
	}

	return (
		<div
			className={cn("flex h-11 shrink-0 items-center justify-between", lucideStrokeClass)}
			data-testid="mobile-recording-toolbar"
		>
			<button
				type="button"
				onClick={onOpenGroupSheet}
				className="-ml-2 flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-5 active:opacity-70"
				data-testid="mobile-recording-group-trigger"
			>
				{/* Keep long group names on one line without displacing the fixed action buttons. */}
				<span className="min-w-0 truncate font-poppins text-[18px] font-medium leading-7 text-foreground">
					{displayGroupLabel}
				</span>
				<ChevronDown className="size-5 shrink-0 text-foreground" />
				<span className="ml-1 shrink-0 text-[13px] tabular-nums leading-5 text-muted-foreground">
					{groupCount}
				</span>
			</button>

			<div
				className="flex shrink-0 items-center"
				data-testid="mobile-recording-toolbar-actions"
			>
				<button
					type="button"
					onClick={onOpenImportSheet}
					className="flex size-11 items-center justify-center rounded-full active:bg-foreground/[0.06]"
					aria-label={t("super:mobile.recordingEntry.toolbar.uploadAria")}
					data-testid="mobile-recording-upload-button"
				>
					<Upload className="size-5 text-foreground" />
				</button>

				<button
					type="button"
					onClick={onOpenFilterSheet}
					className="relative flex size-11 items-center justify-center rounded-full active:bg-foreground/[0.06]"
					aria-label={t("super:mobile.recordingEntry.toolbar.filterAria")}
					data-testid="mobile-recording-filter-button"
				>
					<ListFilter className="size-5 text-foreground" />
					{activeFilterCount > 0 ? (
						<span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-[3px] text-[10px] font-bold leading-none text-primary-foreground">
							{activeFilterCount}
						</span>
					) : null}
				</button>

				<button
					type="button"
					onClick={onOpenSearch}
					className="flex size-11 items-center justify-center rounded-full active:bg-foreground/[0.06]"
					aria-label={t("super:mobile.recordingEntry.toolbar.searchAria")}
					data-testid="mobile-recording-search-button"
				>
					<Search className="size-5 text-foreground" />
				</button>
			</div>
		</div>
	)
}
