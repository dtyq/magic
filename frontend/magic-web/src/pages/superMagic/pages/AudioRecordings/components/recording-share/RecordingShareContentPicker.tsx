import { ChevronDown } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import MobileFileSelectionCheckbox from "@/pages/superMagic/components/TopicFilesButton/components/MobileFileSelectionCheckbox"
import type { AttachmentNodeSelectionState } from "@/pages/superMagic/components/TopicFilesButton/utils/mobileAttachmentTreeSelection"
import { cn } from "@/utils/cn"
import type { RecordingShareGroupedItem } from "../../utils/build-recording-share-selection"
import {
	resolveRecordingShareItemLabel,
	resolveRecordingShareSummaryRootLabel,
} from "./resolve-recording-share-item-label"

interface RecordingShareContentPickerProps {
	groupedItems: RecordingShareGroupedItem[]
	selectedFileIds: string[]
	onToggleFileId: (fileId: string) => void
	onSetSelectedFileIds: (fileIds: string[]) => void
}

/** Maps selected count to the mobile circular checkbox tri-state model. */
function resolveGroupSelectionState(
	fileIds: string[],
	selectedFileIds: string[],
): AttachmentNodeSelectionState {
	if (fileIds.length === 0) return "none"

	const selectedCount = fileIds.filter((fileId) => selectedFileIds.includes(fileId)).length
	if (selectedCount === 0) return "none"
	if (selectedCount === fileIds.length) return "all"
	return "partial"
}

/** Merges selected ids with another group without relying on Set iteration downlevel. */
function mergeSelectedFileIds(currentIds: string[], fileIdsToAdd: string[]) {
	const merged = [...currentIds]
	const seen = new Set(currentIds)

	for (const fileId of fileIdsToAdd) {
		if (seen.has(fileId)) continue
		seen.add(fileId)
		merged.push(fileId)
	}

	return merged
}

/**
 * Mobile recording share picker aligned with the H5 prototype:
 * circular checkboxes, grouped summary row with trailing chevron, and card dividers.
 */
export function RecordingShareContentPicker({
	groupedItems,
	selectedFileIds,
	onToggleFileId,
	onSetSelectedFileIds,
}: RecordingShareContentPickerProps) {
	const { t } = useTranslation("audioRecordings")
	const [summaryExpanded, setSummaryExpanded] = useState(false)

	const primaryItems = useMemo(
		() => groupedItems.filter((item) => item.groupKey !== "summary"),
		[groupedItems],
	)
	const summaryItems = useMemo(
		() => groupedItems.filter((item) => item.groupKey === "summary"),
		[groupedItems],
	)
	const summaryFileIds = useMemo(() => summaryItems.map((item) => item.fileId), [summaryItems])
	const summaryRootLabel = resolveRecordingShareSummaryRootLabel()
	const singleSummaryItem = summaryItems.length === 1 ? summaryItems[0] : undefined

	if (groupedItems.length === 0) {
		return null
	}

	function toggleSummaryGroup() {
		const nextState = resolveGroupSelectionState(summaryFileIds, selectedFileIds)
		if (nextState === "all") {
			onSetSelectedFileIds(
				selectedFileIds.filter((fileId) => !summaryFileIds.includes(fileId)),
			)
			return
		}

		onSetSelectedFileIds(mergeSelectedFileIds(selectedFileIds, summaryFileIds))
	}

	return (
		<div className="space-y-2" data-testid="recording-share-content-picker">
			<div className="px-3.5 text-sm leading-5 text-[#8A8A8A]">{t("share.contentLabel")}</div>
			<div className="overflow-hidden rounded-[14px] bg-white">
				{primaryItems.map((item, index) => (
					<ShareContentRow
						key={item.fileId}
						label={resolveRecordingShareItemLabel(item)}
						checked={selectedFileIds.includes(item.fileId)}
						showDivider={index < primaryItems.length - 1 || summaryItems.length > 0}
						onToggle={() => onToggleFileId(item.fileId)}
						testId={`recording-share-item-${item.groupKey}`}
					/>
				))}

				{singleSummaryItem ? (
					<ShareContentRow
						label={summaryRootLabel}
						checked={selectedFileIds.includes(singleSummaryItem.fileId)}
						onToggle={() => onToggleFileId(singleSummaryItem.fileId)}
						testId="recording-share-item-summary"
					/>
				) : null}

				{summaryItems.length > 1 ? (
					<>
						<SummaryGroupRow
							label={summaryRootLabel}
							selectionState={resolveGroupSelectionState(
								summaryFileIds,
								selectedFileIds,
							)}
							expanded={summaryExpanded}
							showDivider={summaryExpanded}
							expandAriaLabel={t("share.expandSummary")}
							collapseAriaLabel={t("share.collapseSummary")}
							onToggleSelection={toggleSummaryGroup}
							onToggleExpanded={() => setSummaryExpanded((current) => !current)}
						/>
						{summaryExpanded
							? summaryItems.map((item, index) => (
									<ShareContentRow
										key={item.fileId}
										label={resolveRecordingShareItemLabel(item)}
										checked={selectedFileIds.includes(item.fileId)}
										showDivider={index < summaryItems.length - 1}
										indented
										onToggle={() => onToggleFileId(item.fileId)}
										testId={`recording-share-summary-${item.summaryType}`}
									/>
								))
							: null}
					</>
				) : null}
			</div>
		</div>
	)
}

/** Left inset for summary children: aligns child checkbox with the parent summary label. */
const SUMMARY_CHILD_ROW_PL = "pl-11 pr-3.5"

/** Renders one selectable row inside the recording share content card. */
function ShareContentRow({
	label,
	checked,
	showDivider = false,
	indented = false,
	onToggle,
	testId,
}: {
	label: string
	checked: boolean
	showDivider?: boolean
	indented?: boolean
	onToggle: () => void
	testId: string
}) {
	return (
		<>
			<div
				className={cn(
					"flex min-h-[52px] w-full items-center",
					indented ? SUMMARY_CHILD_ROW_PL : "px-1.5",
				)}
			>
				<MobileFileSelectionCheckbox
					state={checked ? "all" : "none"}
					onClick={onToggle}
					ariaLabel={label}
					data-testid={`${testId}-checkbox`}
				/>
				<button
					type="button"
					className="flex min-h-[52px] flex-1 items-center py-3 pl-0.5 text-left active:opacity-75"
					onClick={onToggle}
					data-testid={testId}
				>
					<span className="text-[16px] leading-5 text-foreground">{label}</span>
				</button>
			</div>
			{showDivider ? <div className="mx-3.5 h-px bg-border" /> : null}
		</>
	)
}

/** Summary parent row: circular checkbox on the left and expand chevron on the right. */
function SummaryGroupRow({
	label,
	selectionState,
	expanded,
	showDivider = false,
	expandAriaLabel,
	collapseAriaLabel,
	onToggleSelection,
	onToggleExpanded,
}: {
	label: string
	selectionState: AttachmentNodeSelectionState
	expanded: boolean
	showDivider?: boolean
	expandAriaLabel: string
	collapseAriaLabel: string
	onToggleSelection: () => void
	onToggleExpanded: () => void
}) {
	const expandLabel = expanded ? collapseAriaLabel : expandAriaLabel

	return (
		<>
			<div className="flex min-h-[52px] w-full items-center px-1.5">
				<MobileFileSelectionCheckbox
					state={selectionState}
					onClick={onToggleSelection}
					ariaLabel={label}
					data-testid="recording-share-summary-checkbox"
				/>
				<button
					type="button"
					className="flex min-h-[52px] flex-1 items-center py-3 pl-0.5 text-left active:opacity-75"
					onClick={onToggleExpanded}
					data-testid="recording-share-summary-toggle"
				>
					<span className="text-[16px] leading-5 text-foreground">{label}</span>
				</button>
				<button
					type="button"
					className="flex h-[52px] w-10 shrink-0 items-center justify-center active:opacity-75"
					onClick={onToggleExpanded}
					aria-label={expandLabel}
					data-testid="recording-share-summary-expand"
				>
					<ChevronDown
						className={cn(
							"h-4 w-4 text-[#8A8A8A] transition-transform duration-200",
							!expanded && "-rotate-90",
						)}
					/>
				</button>
			</div>
			{showDivider ? <div className="mx-3.5 h-px bg-border" /> : null}
		</>
	)
}
