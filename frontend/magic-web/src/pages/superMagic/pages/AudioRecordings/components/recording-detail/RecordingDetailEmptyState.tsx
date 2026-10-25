import { FileAudio, FileText, Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Skeleton } from "@/components/shadcn-ui/skeleton"
import { cn } from "@/utils/cn"
import {
	RECORDING_DETAIL_SUMMARY_MIN_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH,
	RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH,
	RECORDING_DETAIL_WORKBENCH_MIN_WIDTH,
} from "./recording-detail-layout"

export type RecordingDetailEmptyVariant =
	| "pageLoading"
	| "pageError"
	| "projectMissing"
	| "noAudio"
	| "noTranscript"
	| "noNotes"
	| "noSummary"
	| "noSummaryFile"
	| "summaryPending"
	| "summaryGenerating"
	| "summaryFailed"
	| "shareNoTranscript"
	| "shareNoReadable"

interface RecordingDetailEmptyStateProps {
	variant: RecordingDetailEmptyVariant
	className?: string
	onAction?: () => void
	actionLabel?: string
	compact?: boolean
}

/** Unified empty/placeholder states for owner and future share recording detail workbench regions. */
export function RecordingDetailEmptyState({
	variant,
	className,
	onAction,
	actionLabel,
	compact = false,
}: RecordingDetailEmptyStateProps) {
	const { t } = useTranslation("audioRecordings")
	const copy = resolveEmptyCopy(variant, t)

	if (variant === "pageLoading") {
		return (
			<div className={cn("flex h-full items-center justify-center", className)} role="status">
				<Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
				<span className="text-sm text-muted-foreground">{t("detail.loading")}</span>
			</div>
		)
	}

	const icon = resolveEmptyIcon(variant)

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center",
				compact ? "gap-2 px-4 py-8" : "gap-3 px-8 py-16",
				className,
			)}
			data-testid={`recording-detail-empty-${variant}`}
		>
			{icon ? (
				<div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
					{icon}
				</div>
			) : null}
			<div className="space-y-1">
				{copy.title ? (
					<p className="text-sm font-medium text-foreground">{copy.title}</p>
				) : null}
				{copy.description ? (
					<p className="text-sm text-muted-foreground">{copy.description}</p>
				) : null}
			</div>
			{onAction && actionLabel ? (
				<Button
					size="sm"
					onClick={onAction}
					className="h-10 rounded-full bg-foreground px-5 text-[14px] font-semibold text-background hover:bg-foreground/90"
				>
					{actionLabel}
				</Button>
			) : null}
		</div>
	)
}

/** Maps each empty variant to localized title and description copy. */
function resolveEmptyCopy(
	variant: RecordingDetailEmptyVariant,
	t: ReturnType<typeof useTranslation>["t"],
) {
	if (variant === "pageError") {
		return { title: t("detail.loadFailed"), description: "" }
	}
	if (variant === "projectMissing") {
		return { title: t("detail.entryNotFound"), description: "" }
	}
	if (variant === "noAudio") {
		return { title: t("detail.empty.noAudio"), description: t("detail.empty.noAudioHint") }
	}
	if (variant === "noTranscript") {
		return {
			title: t("detail.emptySummary"),
			// Keep transcript-empty copy minimal so the empty state matches the latest product wording.
			description: "",
		}
	}
	if (variant === "noNotes") {
		return { title: t("detail.emptySummary"), description: "" }
	}
	if (variant === "noSummary") {
		return { title: t("detail.emptySummary"), description: "" }
	}
	if (variant === "noSummaryFile") {
		return { title: t("detail.emptySummary"), description: "" }
	}
	if (variant === "summaryPending") {
		return { title: t("detail.notSummarized"), description: t("detail.notSummarizedHint") }
	}
	if (variant === "summaryGenerating") {
		return { title: t("detail.summarizingHint"), description: "" }
	}
	if (variant === "summaryFailed") {
		return {
			title: t("detail.empty.summaryFailed"),
			description: t("detail.empty.summaryFailedHint"),
		}
	}
	if (variant === "shareNoTranscript") {
		return { title: t("detail.empty.shareNoTranscript"), description: "" }
	}
	if (variant === "shareNoReadable") {
		return { title: t("detail.empty.shareNoReadable"), description: "" }
	}
	return { title: "", description: "" }
}

/** Picks a lightweight icon per empty variant for visual scanning. */
function resolveEmptyIcon(variant: RecordingDetailEmptyVariant) {
	if (variant === "noAudio") return <FileAudio className="size-5" />
	if (variant === "noTranscript" || variant === "noNotes" || variant === "shareNoTranscript") {
		return <FileText className="size-5" />
	}
	if (variant === "summaryGenerating") {
		return <Loader2 className="size-5 animate-spin" />
	}
	if (
		variant === "noSummary" ||
		variant === "noSummaryFile" ||
		variant === "summaryPending" ||
		variant === "summaryFailed"
	) {
		return <Sparkles className="size-5" />
	}
	return null
}

/** Waveform bar heights mirroring the collapsed audio bar seek strip. */
const PLAYER_WAVEFORM_BAR_HEIGHTS = [
	6, 10, 8, 12, 7, 11, 9, 13, 8, 10, 6, 12, 9, 11, 7, 10, 8, 13, 9, 11,
]

/** Transcript segment placeholders with meta row plus multi-line body. */
const TRANSCRIPT_SEGMENT_SKELETONS = [
	{ bodyLines: ["w-full", "w-[92%]"] },
	{ bodyLines: ["w-[88%]", "w-[76%]", "w-[64%]"] },
	{ bodyLines: ["w-full", "w-[84%]"] },
	{ bodyLines: ["w-[72%]"] },
] as const

/** Four alternating message placeholders matching the compact chat loading state. */
const CHAT_MESSAGE_SKELETONS = [
	{ alignment: "end", bubbleWidth: "w-[78%]", lines: ["w-full"] },
	{ alignment: "start", bubbleWidth: "w-[88%]", lines: ["w-full", "w-[82%]"] },
	{ alignment: "end", bubbleWidth: "w-[68%]", lines: ["w-full", "w-[74%]"] },
	{ alignment: "start", bubbleWidth: "w-[82%]", lines: ["w-full", "w-[68%]"] },
] as const

/** Skeleton placeholder aligned with the PC collapsed RecordingDetailAudioBar transport row. */
function RecordingDetailPlayerSkeleton() {
	return (
		<div
			className="shrink-0 rounded-2xl border border-border bg-card"
			data-testid="recording-detail-player-skeleton"
		>
			<div className="flex items-center gap-1.5 px-3 py-1.5">
				<Skeleton className="size-7 shrink-0 rounded-full" />
				<Skeleton className="h-3 w-16 shrink-0 rounded-sm" />
				<div className="flex min-w-0 flex-1 items-center gap-px">
					{PLAYER_WAVEFORM_BAR_HEIGHTS.map((height, index) => (
						<Skeleton
							key={index}
							className="w-0.5 shrink-0 rounded-full"
							style={{ height }}
						/>
					))}
				</div>
				{/* Rate label plus two skip buttons sit between waveform and expand on the PC collapsed bar. */}
				<Skeleton className="h-4 w-8 shrink-0 rounded-sm" />
				<Skeleton className="size-7 shrink-0 rounded-full" />
				<Skeleton className="size-7 shrink-0 rounded-full" />
				<Skeleton className="size-7 shrink-0 rounded-full" />
			</div>
		</div>
	)
}

/** Skeleton placeholder aligned with RecordingDetailTranscriptPanel header and segments. */
function RecordingDetailTranscriptSkeleton() {
	return (
		<div
			// Keep the transcript loading state borderless so it matches the prototype-style content column.
			className="flex min-h-0 flex-1 flex-col overflow-hidden"
			data-testid="recording-detail-transcript-skeleton"
		>
			<div className="flex items-center justify-between px-4 pb-3 pt-1">
				<Skeleton className="h-4 w-24 rounded-sm" />
				<Skeleton className="h-8 w-20 rounded-full" />
			</div>
			<div className="flex min-h-[320px] flex-1 flex-col gap-3 px-4 pb-3">
				{TRANSCRIPT_SEGMENT_SKELETONS.map((segment, index) => (
					<div key={index} className="rounded-xl px-2 py-2.5">
						<div className="mb-1 flex items-center gap-2">
							<Skeleton className="h-3 w-8 shrink-0 rounded-sm" />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
						<div className="space-y-1.5">
							{segment.bodyLines.map((lineWidth, lineIndex) => (
								<Skeleton
									key={lineIndex}
									className={cn("h-4 rounded-sm", lineWidth)}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

/** Skeleton placeholder for the right panel tab strip and summary content. */
function RecordingDetailRightPanelSkeleton() {
	return (
		<div className="flex min-h-0 flex-col gap-4 rounded-[22px] border border-border bg-card p-5">
			<div className="flex items-center gap-2">
				<Skeleton className="h-8 w-16 rounded-full" />
				<Skeleton className="h-8 w-20 rounded-full" />
				<Skeleton className="h-8 w-24 rounded-full" />
				<Skeleton className="h-8 w-14 rounded-full" />
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3">
				<Skeleton className="h-5 w-40 rounded-md" />
				<Skeleton className="h-4 w-full rounded-sm" />
				<Skeleton className="h-4 w-[92%] rounded-sm" />
				<Skeleton className="h-4 w-[78%] rounded-sm" />
				<Skeleton className="h-4 w-[86%] rounded-sm" />
				<Skeleton className="h-4 w-[60%] rounded-sm" />
			</div>
		</div>
	)
}

/** Skeleton placeholder aligned with the desktop recording conversation rail. */
export function RecordingDetailChatSkeleton() {
	return (
		<div
			className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-sidebar"
			data-testid="recording-detail-chat-skeleton"
		>
			<div
				className="flex shrink-0 items-center justify-between px-4 py-3"
				data-testid="recording-detail-chat-header-skeleton"
			>
				<div className="flex min-w-0 items-center gap-2">
					<Skeleton className="size-5 shrink-0 rounded-sm" />
					<Skeleton className="h-4 w-28 rounded-sm" />
				</div>
				<div className="flex items-center gap-2">
					<Skeleton className="size-6 shrink-0 rounded-md" />
					<Skeleton className="size-6 shrink-0 rounded-md" />
					<Skeleton className="size-6 shrink-0 rounded-md" />
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-8 overflow-hidden px-4 py-6">
				{CHAT_MESSAGE_SKELETONS.map((message, messageIndex) => (
					<div
						key={messageIndex}
						data-testid="recording-detail-chat-message-skeleton"
						className={cn(
							"flex gap-2",
							message.alignment === "end" ? "justify-end" : "justify-start",
						)}
					>
						{message.alignment === "start" ? (
							<Skeleton
								className="size-7 shrink-0 rounded-full"
								data-testid="recording-detail-chat-avatar-skeleton"
							/>
						) : null}
						<div
							className={cn(
								"flex max-w-[88%] flex-col gap-2 rounded-2xl px-3 py-3",
								message.bubbleWidth,
								"bg-background/70",
							)}
						>
							{message.lines.map((lineWidth, lineIndex) => (
								<Skeleton
									key={lineIndex}
									className={cn("h-3 rounded-sm", lineWidth)}
								/>
							))}
						</div>
						{message.alignment === "end" ? (
							<Skeleton
								className="size-7 shrink-0 rounded-full"
								data-testid="recording-detail-chat-avatar-skeleton"
							/>
						) : null}
					</div>
				))}
			</div>
			<div className="shrink-0 p-3">
				<div
					className="rounded-2xl border border-border/70 bg-background p-3"
					data-testid="recording-detail-chat-composer-skeleton"
				>
					<div className="flex items-start gap-2">
						<Skeleton className="size-7 shrink-0 rounded-lg" />
						<div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
							<Skeleton className="h-3 w-24 rounded-sm" />
							<Skeleton className="h-3 w-[78%] rounded-sm" />
							<Skeleton className="h-3 w-[58%] rounded-sm" />
						</div>
					</div>
					<div className="mt-5 flex items-center justify-between gap-3">
						<Skeleton
							className="h-8 w-32 rounded-lg"
							data-testid="recording-detail-chat-input-skeleton"
						/>
						<div className="flex items-center gap-2">
							<Skeleton className="size-8 rounded-lg" />
							<Skeleton className="size-8 rounded-lg" />
							<Skeleton className="size-8 rounded-lg" />
							<Skeleton
								className="size-8 rounded-lg"
								data-testid="recording-detail-chat-send-skeleton"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

/** Three-column skeleton with shimmer and fade-in while the detail data hook is loading. */
export function RecordingDetailPageSkeleton() {
	return (
		<div
			className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin]"
			data-testid="recording-detail-page-skeleton-scroll"
		>
			<div
				className="grid h-full min-h-0 w-full gap-6 px-8 pb-8 pt-4 duration-300 animate-in fade-in"
				style={{
					minWidth: RECORDING_DETAIL_WORKBENCH_MIN_WIDTH,
					gridTemplateColumns: `minmax(${RECORDING_DETAIL_TRANSCRIPT_MIN_WIDTH}px, ${RECORDING_DETAIL_TRANSCRIPT_MAX_WIDTH}px) minmax(${RECORDING_DETAIL_SUMMARY_MIN_WIDTH}px, 1fr)`,
				}}
				role="status"
				aria-busy="true"
				data-testid="recording-detail-page-skeleton"
			>
				<div className="flex min-h-0 flex-col gap-4">
					<RecordingDetailPlayerSkeleton />
					<RecordingDetailTranscriptSkeleton />
				</div>
				<RecordingDetailRightPanelSkeleton />
			</div>
		</div>
	)
}
