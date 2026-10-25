import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { UNGROUPED_RECORDING_GROUP_ID } from "@/services/audioRecordings/RecordingGroupsConstants"
import { resolveRecordingGroupDisplayName } from "@/services/audioRecordings/resolveRecordingGroupDisplayName"
import type { MobileRecordingGroup } from "./MobileRecordingGroupSheet"

interface MobileRecordingMoveGroupSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	groups: MobileRecordingGroup[]
	selectedGroupId?: string | null
	ungroupedCount: number
	onSelect: (groupId: string) => void
}

/** Move-target row with leading check slot aligned to the group picker sheet */
function MoveGroupRow({
	label,
	count,
	selected,
	dataTestId,
	onClick,
}: {
	label: string
	count: number
	selected: boolean
	dataTestId: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={dataTestId}
			className="flex h-12 w-full items-center gap-2 bg-transparent pl-[14px] pr-[14px] transition-opacity active:opacity-60"
		>
			<span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
				{selected ? <Check className="size-4 text-primary" strokeWidth={2.5} /> : null}
			</span>
			<span className="flex min-w-0 flex-1 items-baseline gap-1.5">
				<span className="min-w-0 truncate text-left text-[16px] leading-5 text-foreground">
					{label}
				</span>
				<span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
					{count}
				</span>
			</span>
		</button>
	)
}

/** Selects a legal destination for moving a recording; aggregate "all" is intentionally hidden */
export function MobileRecordingMoveGroupSheet({
	open,
	onOpenChange,
	groups = [],
	selectedGroupId,
	ungroupedCount,
	onSelect,
}: MobileRecordingMoveGroupSheetProps) {
	const { t } = useTranslation("super")
	const unnamedGroupLabel = t("mobile.recordingEntry.groupSheet.unnamedGroup")

	function handleClose() {
		onOpenChange(false)
	}

	function handleSelect(groupId: string) {
		onSelect(groupId)
		onOpenChange(false)
	}

	return (
		<MagicPopup
			visible={open}
			onOpenChange={onOpenChange}
			onClose={handleClose}
			position="bottom"
			title={t("mobile.recordingEntry.moveGroupSheet.title")}
			headerVariant="actionHeader"
			headerTitle={t("mobile.recordingEntry.moveGroupSheet.title")}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("mobile.recordingEntry.moveGroupSheet.closeAria"),
				onClick: handleClose,
				testId: "mobile-recording-move-group-close",
			}}
			// Keep destination focus from scrolling the fixed action header.
			className="max-h-[78vh] gap-0 rounded-t-[14px] border-0 bg-muted p-0 supports-[overflow:clip]:overflow-clip"
			bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 supports-[overflow:clip]:overflow-clip"
			style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			data-testid="mobile-recording-move-group-sheet"
		>
			<ScrollArea
				className="grid min-h-0 flex-1"
				viewportClassName="h-auto min-h-0 px-[14px] py-[10px] [&>div]:!block"
			>
				<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
					{groups.map((group) => (
						<div key={group.id}>
							<MoveGroupRow
								label={resolveRecordingGroupDisplayName(
									group.name,
									unnamedGroupLabel,
								)}
								count={group.projectCount}
								selected={selectedGroupId === group.id}
								dataTestId="mobile-recording-move-group-option"
								onClick={() => handleSelect(group.id)}
							/>
							<div className="h-px w-full bg-border" />
						</div>
					))}
					<MoveGroupRow
						label={t("mobile.recordingEntry.groupSheet.ungrouped")}
						count={ungroupedCount}
						selected={selectedGroupId === UNGROUPED_RECORDING_GROUP_ID}
						dataTestId="mobile-recording-move-group-option-ungrouped"
						onClick={() => handleSelect(UNGROUPED_RECORDING_GROUP_ID)}
					/>
				</div>
			</ScrollArea>
		</MagicPopup>
	)
}
