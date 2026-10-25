import { useEffect, useState } from "react"
import type { AnchorHTMLAttributes, ComponentProps, MouseEvent } from "react"
import { cn } from "@/utils/cn"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { resolveSingleImageUrl } from "@/pages/superMagic/utils/image-url-resolver"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	isRecordingTimeText,
	parseMarkdownSpeakerLink,
	parseMarkdownTimeLink,
	parseRecordingInlineCodeTimeLink,
} from "../../utils/markdown-time-links"
import { resolveSpeakerChipStyle } from "../../utils/resolve-speaker-chip-style"
import { parseRecordingTimeToSeconds } from "../../utils/time"

export type RecordingMarkdownLayout = "desktop" | "mobile"

export interface RecordingMarkdownComponentOptions {
	onSpeakerClick?: (speakerId: string) => void
	onTimeClick?: (seconds: number) => void
	speakerNameMap?: Record<string, string>
	timeLinkTestId?: string
	speakerLinkTestId?: string
	attachments?: AttachmentFile[]
	relativeFilePath?: string
}

/** Test hook for time chip class — click affordance lives in `.recording-time-chip` (index.css). */
export const RECORDING_TIME_CHIP_CLASS = "recording-time-chip"

export interface RecordingSpeakerChipProps {
	label: string
	speakerId: string
	onSpeakerClick?: (speakerId: string) => void
	testId: string
	stopPropagation?: boolean
}

export interface RecordingTimeChipProps {
	label: string
	seconds: number
	onTimeClick?: (seconds: number) => void
	testId: string
	stopPropagation?: boolean
}

/** Builds ReactMarkdown overrides that require parsing, interaction, or extra DOM structure. */
export function createRecordingMarkdownComponents({
	onSpeakerClick,
	onTimeClick,
	speakerNameMap = {},
	timeLinkTestId = "recording-detail-time-link",
	speakerLinkTestId = "recording-detail-speaker-link",
	attachments = [],
	relativeFilePath,
}: RecordingMarkdownComponentOptions = {}) {
	return {
		a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
			<MarkdownAnchor
				{...props}
				onSpeakerClick={onSpeakerClick}
				onTimeClick={onTimeClick}
				timeLinkTestId={timeLinkTestId}
				speakerLinkTestId={speakerLinkTestId}
			/>
		),
		code: (props: ComponentProps<"code">) => (
			<MarkdownCode
				{...props}
				onSpeakerClick={onSpeakerClick}
				onTimeClick={onTimeClick}
				speakerNameMap={speakerNameMap}
				timeLinkTestId={timeLinkTestId}
				speakerLinkTestId={speakerLinkTestId}
			/>
		),
		// Wrapper div is required for isolated horizontal scroll; table cell styles use CSS.
		table: ({ children }: { children?: React.ReactNode }) => (
			<div className="recording-md-table-wrap">
				<table>{children}</table>
			</div>
		),
		// Cell wrappers provide intrinsic column sizing while capping unusually long content.
		th: ({ children, node, ...props }: ComponentProps<"th"> & { node?: unknown }) => {
			void node
			return (
				<th {...props}>
					<div className="recording-md-cell-content">{children}</div>
				</th>
			)
		},
		td: ({ children, node, ...props }: ComponentProps<"td"> & { node?: unknown }) => {
			void node
			return (
				<td {...props}>
					<div className="recording-md-cell-content">{children}</div>
				</td>
			)
		},
		// Read-only markdown must not toggle GFM task checkboxes.
		input: ({ checked, ...props }: ComponentProps<"input">) => (
			<input type="checkbox" checked={checked} readOnly {...props} />
		),
		img: (props: ComponentProps<"img">) => (
			<RecordingMarkdownImage
				{...props}
				attachments={attachments}
				relativeFilePath={relativeFilePath}
			/>
		),
	}
}

/** Resolves project-relative note images to temporary download URLs before rendering. */
function RecordingMarkdownImage({
	attachments,
	relativeFilePath,
	src,
	...props
}: ComponentProps<"img"> & {
	attachments: AttachmentFile[]
	relativeFilePath?: string
}) {
	const [resolvedSrc, setResolvedSrc] = useState(src)
	const fileApi = useFileApi()

	useEffect(() => {
		let disposed = false
		if (!src || !attachments.length || /^(?:data:|https?:|blob:)/i.test(src)) {
			setResolvedSrc(src)
			return () => {
				disposed = true
			}
		}

		void resolveSingleImageUrl(src, attachments, relativeFilePath, undefined, fileApi).then(
			(nextSrc) => {
				if (!disposed) setResolvedSrc(nextSrc)
			},
		)

		return () => {
			disposed = true
		}
	}, [attachments, fileApi, relativeFilePath, src])

	return <img {...props} src={resolvedSrc} />
}

/** Converts inline code-wrapped magic-time links into playable time controls. */
function MarkdownCode({
	children,
	onSpeakerClick,
	onTimeClick,
	speakerNameMap = {},
	timeLinkTestId,
	speakerLinkTestId,
}: {
	children?: React.ReactNode
	onSpeakerClick?: (speakerId: string) => void
	onTimeClick?: (seconds: number) => void
	speakerNameMap: Record<string, string>
	timeLinkTestId: string
	speakerLinkTestId: string
}) {
	const text = String(children ?? "").trim()
	const magicTimeLink = parseRecordingInlineCodeTimeLink(text)
	const speakerId = text.match(/^(Speaker-[\w-]+)$/)?.[1] ?? null
	const speakerGroup = text.match(/^\[((?:Speaker-[\w-]+)(?:\s*,\s*Speaker-[\w-]+)+)]$/)?.[1]

	if (magicTimeLink) {
		return (
			<RecordingTimeChip
				label={magicTimeLink.label}
				seconds={magicTimeLink.seconds}
				onTimeClick={onTimeClick}
				testId={timeLinkTestId}
			/>
		)
	}

	if (isRecordingTimeText(text)) {
		return (
			<RecordingTimeChip
				label={text}
				seconds={parseRecordingTimeToSeconds(text)}
				onTimeClick={onTimeClick}
				testId={timeLinkTestId}
			/>
		)
	}

	if (speakerGroup) {
		const speakerIds = speakerGroup.split(/\s*,\s*/)
		return (
			<>
				{/* Preserve the original group semantics while exposing each speaker as an individual settings entry. */}
				{speakerIds.map((item, index) => (
					<span key={item}>
						{index > 0 ? " " : null}
						<RecordingSpeakerChip
							label={resolveSpeakerLabel(item, speakerNameMap)}
							speakerId={item}
							onSpeakerClick={onSpeakerClick}
							testId={speakerLinkTestId}
						/>
					</span>
				))}
			</>
		)
	}

	if (speakerId) {
		return (
			<RecordingSpeakerChip
				label={resolveSpeakerLabel(speakerId, speakerNameMap)}
				speakerId={speakerId}
				onSpeakerClick={onSpeakerClick}
				testId={speakerLinkTestId}
			/>
		)
	}

	return <code>{children}</code>
}

/** Keeps regular links intact while internal magic-time links seek the shared audio player. */
function MarkdownAnchor({
	href,
	children,
	onSpeakerClick,
	onTimeClick,
	timeLinkTestId,
	speakerLinkTestId,
	...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
	onSpeakerClick?: (speakerId: string) => void
	onTimeClick?: (seconds: number) => void
	timeLinkTestId: string
	speakerLinkTestId: string
}) {
	const seconds = parseMarkdownTimeLink(href)
	const speakerId = parseMarkdownSpeakerLink(href)

	if (seconds != null) {
		return (
			<RecordingTimeChip
				label={String(children ?? "")}
				seconds={seconds}
				onTimeClick={onTimeClick}
				testId={timeLinkTestId}
			/>
		)
	}

	if (speakerId) {
		return (
			<RecordingSpeakerChip
				label={String(children ?? "")}
				speakerId={speakerId}
				onSpeakerClick={onSpeakerClick}
				testId={speakerLinkTestId}
			/>
		)
	}

	return (
		<a {...rest} href={href} target="_blank" rel="noreferrer">
			{children}
		</a>
	)
}

/** Reuses the shared speaker chip look-and-feel for both markdown links and code-wrapped speaker ids. */
export function RecordingSpeakerChip({
	label,
	speakerId,
	onSpeakerClick,
	testId,
	stopPropagation = false,
}: RecordingSpeakerChipProps) {
	const chipStyle = resolveSpeakerChipStyle(speakerId)

	/** Keeps nested interactive contexts from also triggering the parent seek card. */
	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		if (stopPropagation) event.stopPropagation()
		onSpeakerClick?.(speakerId)
	}

	return (
		<button
			type="button"
			className={cn("recording-speaker-chip", chipStyle.chip)}
			onClick={handleClick}
			data-testid={testId}
			data-speaker-id={speakerId}
			title={label}
		>
			<span className={cn("recording-speaker-chip-dot", chipStyle.dot)} />
			<span className="recording-speaker-chip-label">{label}</span>
		</button>
	)
}

/** Resolves the user-edited speaker label without mutating the stored speaker id. */
export function resolveSpeakerLabel(
	speakerId: string,
	speakerNameMap: Record<string, string>,
): string {
	return speakerNameMap[speakerId]?.trim() || speakerId
}

/** Renders an inline time control that seeks playback. Visual click cues live on `.recording-time-chip`. */
export function RecordingTimeChip({
	label,
	seconds,
	onTimeClick,
	testId,
	stopPropagation = false,
}: RecordingTimeChipProps) {
	/** Keeps inline time chips independent from parent topic-card seek handlers. */
	function handleClick(event: MouseEvent<HTMLButtonElement>) {
		if (stopPropagation) event.stopPropagation()
		onTimeClick?.(seconds)
	}

	return (
		<button
			type="button"
			className={RECORDING_TIME_CHIP_CLASS}
			onClick={handleClick}
			data-testid={testId}
		>
			{/* Same flex row as the speaker chip: mark and label are separate items so they share one center line. */}
			<svg aria-hidden viewBox="0 0 8 8" className="recording-time-chip-icon">
				<path d="M1.2 0.7 7 4 1.2 7.3Z" fill="currentColor" />
			</svg>
			<span className="recording-time-chip-label">{label}</span>
		</button>
	)
}
