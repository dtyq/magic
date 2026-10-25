import { useState } from "react"
import { Check, ListFilter, RotateCcw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import { resolveSpeakerChipStyle } from "../../utils/resolve-speaker-chip-style"
import {
	isSpeakerFilterActive,
	normalizeSpeakerSelection,
	toggleSpeakerSelection,
} from "../../utils/speaker-filter"

interface RecordingSpeakerFilterControlProps {
	speakerIds: string[]
	selectedIds: string[]
	onChange: (speakerIds: string[]) => void
	labels: Record<string, string>
	title: string
	presentation: "menu" | "sheet"
	safeBottom?: number
	className?: string
}

/** Shares the same speaker-filter behavior across desktop dropdown and mobile bottom-sheet UIs. */
export function RecordingSpeakerFilterControl({
	speakerIds,
	selectedIds,
	onChange,
	labels,
	title,
	presentation,
	safeBottom = 0,
	className,
}: RecordingSpeakerFilterControlProps) {
	const { t } = useTranslation("audioRecordings")
	const normalizedSelected = normalizeSpeakerSelection(speakerIds, selectedIds)
	const filterActive = isSpeakerFilterActive(speakerIds, selectedIds)

	if (speakerIds.length <= 1) return null

	/** Restores the default "all speakers visible" state in a single step. */
	function handleReset() {
		onChange(speakerIds)
	}

	/** Reuses the shared toggle state machine so both presentations stay behaviorally identical. */
	function handleToggleSpeaker(speakerId: string) {
		onChange(toggleSpeakerSelection(speakerIds, normalizedSelected, speakerId))
	}

	/** Renders the shared trigger shell while letting each presentation decide how to open itself. */
	function renderTrigger(onClick: () => void) {
		return (
			<button
				type="button"
				className={cn(
					presentation === "sheet"
						? "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-foreground/[0.06]"
						: "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-muted/30",
					className,
				)}
				aria-label={title}
				data-testid="recording-detail-open-speaker-filter"
				onClick={onClick}
			>
				<ListFilter
					className={presentation === "sheet" ? "size-5" : "size-4"}
					strokeWidth={2}
				/>
				{filterActive ? (
					<span
						className={cn(
							"absolute flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
							presentation === "sheet"
								? "right-1 top-1 h-4 bg-primary text-primary-foreground"
								: "-right-1 -top-1 h-4 bg-foreground text-background",
						)}
					>
						{normalizedSelected.length}
					</span>
				) : null}
			</button>
		)
	}

	if (presentation === "menu") {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>{renderTrigger(() => undefined)}</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					sideOffset={8}
					className="w-44 overflow-hidden rounded-xl border-border/80 p-1"
					data-testid="recording-detail-speaker-filter-menu"
				>
					{/* Reserve reset space before selection so the focused last row stays visible. */}
					<ScrollArea viewportClassName="h-auto max-h-[calc(var(--radix-dropdown-menu-content-available-height)-44px)] [&>div]:!block">
						{speakerIds.map((speakerId) => (
							<SpeakerFilterMenuItem
								key={speakerId}
								speakerId={speakerId}
								label={labels[speakerId] ?? speakerId}
								selected={normalizedSelected.includes(speakerId)}
								onSelect={handleToggleSpeaker}
							/>
						))}
					</ScrollArea>
					{filterActive ? (
						<>
							<DropdownMenuItem
								className="h-9 text-muted-foreground"
								onSelect={(event) => {
									event.preventDefault()
									handleReset()
								}}
							>
								{t("detail.speakerFilterReset")}
							</DropdownMenuItem>
						</>
					) : null}
				</DropdownMenuContent>
			</DropdownMenu>
		)
	}

	return (
		<MobileSpeakerFilterSheet
			title={title}
			filterActive={filterActive}
			safeBottom={safeBottom}
			speakerIds={speakerIds}
			labels={labels}
			selectedIds={normalizedSelected}
			onReset={handleReset}
			onToggleSpeaker={handleToggleSpeaker}
		/>
	)
}

/** Renders a desktop dropdown row with the shared color dot and selection affordance. */
function SpeakerFilterMenuItem({
	speakerId,
	label,
	selected,
	onSelect,
}: {
	speakerId: string
	label: string
	selected: boolean
	onSelect: (speakerId: string) => void
}) {
	const chipStyle = resolveSpeakerChipStyle(speakerId)

	return (
		<DropdownMenuItem
			className="h-9 gap-2 rounded-lg px-3 text-[13px]"
			data-testid="recording-detail-speaker-filter-option"
			onSelect={(event) => {
				event.preventDefault()
				onSelect(speakerId)
			}}
		>
			<span className={cn("size-2 shrink-0 rounded-full", chipStyle.dot)} />
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{selected ? (
				<Check className="size-4 shrink-0 text-foreground" strokeWidth={2} />
			) : null}
		</DropdownMenuItem>
	)
}

/** Uses the existing mobile popup shell so the filter sheet matches the page's other bottom actions. */
function MobileSpeakerFilterSheet({
	title,
	filterActive,
	safeBottom,
	speakerIds,
	labels,
	selectedIds,
	onReset,
	onToggleSpeaker,
}: {
	title: string
	filterActive: boolean
	safeBottom: number
	speakerIds: string[]
	labels: Record<string, string>
	selectedIds: string[]
	onReset: () => void
	onToggleSpeaker: (speakerId: string) => void
}) {
	const { t } = useTranslation("audioRecordings")
	const [open, setOpen] = useState(false)

	return (
		<>
			<button
				type="button"
				className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors active:bg-foreground/[0.06]"
				aria-label={title}
				data-testid="recording-detail-open-speaker-filter"
				onClick={() => setOpen(true)}
			>
				<ListFilter className="size-5" strokeWidth={2} />
				{filterActive ? (
					<span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
						{selectedIds.length}
					</span>
				) : null}
			</button>
			<MagicPopup
				visible={open}
				onClose={() => setOpen(false)}
				position="bottom"
				title={title}
				headerVariant="actionHeader"
				headerTitle={title}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("actions.cancel"),
					onClick: () => setOpen(false),
					testId: "recording-detail-speaker-filter-close",
				}}
				headerTrailingAction={
					filterActive
						? {
								icon: <RotateCcw />,
								ariaLabel: t("detail.speakerFilterReset"),
								onClick: onReset,
								testId: "recording-detail-speaker-filter-reset",
							}
						: undefined
				}
				// Clip popup ancestors so focusing the last row cannot scroll the fixed header away.
				className="flex flex-col overflow-hidden rounded-t-2xl border-0 bg-muted p-0 supports-[overflow:clip]:overflow-clip"
				bodyClassName="min-h-0 overflow-hidden supports-[overflow:clip]:overflow-clip"
				style={{ boxShadow: "0 -14px 44px rgba(0,0,0,0.18)" }}
				data-testid="recording-detail-speaker-filter-sheet"
			>
				{/* Retain a vh fallback for older WebViews; the sheet header remains outside scrolling. */}
				<ScrollArea viewportClassName="h-auto max-h-[70vh] px-[14px] pb-6 pt-[10px] supports-[height:100dvh]:max-h-[70dvh] [&>div]:!block">
					<div className="overflow-hidden rounded-lg bg-card">
						{speakerIds.map((speakerId) => (
							<MobileSpeakerFilterRow
								key={speakerId}
								speakerId={speakerId}
								label={labels[speakerId] ?? speakerId}
								isFirst={speakerId === speakerIds[0]}
								selected={selectedIds.includes(speakerId)}
								onSelect={onToggleSpeaker}
							/>
						))}
					</div>
					<div style={{ paddingBottom: Math.max(safeBottom, 0) }} />
				</ScrollArea>
			</MagicPopup>
		</>
	)
}

/** Mirrors the mobile prototype row styling while reusing the shared speaker color tokens. */
function MobileSpeakerFilterRow({
	speakerId,
	label,
	isFirst = false,
	selected,
	onSelect,
}: {
	speakerId: string
	label: string
	isFirst?: boolean
	selected: boolean
	onSelect: (speakerId: string) => void
}) {
	const chipStyle = resolveSpeakerChipStyle(speakerId)

	return (
		<button
			type="button"
			className={cn(
				"flex h-12 w-full items-center gap-3 px-[14px] text-left text-[16px] text-foreground active:opacity-70",
				!isFirst && "border-t border-border",
			)}
			data-testid="recording-detail-speaker-filter-option"
			onClick={() => onSelect(speakerId)}
		>
			<span className={cn("size-2.5 shrink-0 rounded-full", chipStyle.dot)} />
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{selected ? <Check className="size-5 shrink-0 text-primary" strokeWidth={2.5} /> : null}
		</button>
	)
}
