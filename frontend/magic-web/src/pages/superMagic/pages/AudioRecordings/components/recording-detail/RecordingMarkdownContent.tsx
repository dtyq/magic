import { useMemo } from "react"
import { useLatest } from "ahooks"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/utils/cn"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { createRecordingMarkdownRemarkPlugin } from "../../utils/markdown-time-links"
import {
	createRecordingMarkdownComponents,
	type RecordingMarkdownLayout,
} from "./recording-markdown-components"
import { RECORDING_MARKDOWN_REHYPE_PLUGINS } from "./recording-markdown-rehype-plugins"

export interface RecordingMarkdownContentProps {
	content: string
	className?: string
	layout?: RecordingMarkdownLayout
	speakerNameMap?: Record<string, string>
	onSpeakerClick?: (speakerId: string) => void
	onTimeClick?: (seconds: number) => void
	timeLinkTestId?: string
	speakerLinkTestId?: string
	attachments?: AttachmentFile[]
	relativeFilePath?: string
}

/** Renders completed markdown and turns generated time marks into audio seek actions. */
export function RecordingMarkdownContent({
	content,
	className,
	layout = "desktop",
	speakerNameMap = {},
	onSpeakerClick,
	onTimeClick,
	timeLinkTestId = "recording-detail-time-link",
	speakerLinkTestId = "recording-detail-speaker-link",
	attachments = [],
	relativeFilePath,
}: RecordingMarkdownContentProps) {
	// Keep ReactMarkdown component overrides stable during playback RAF re-renders so chip clicks are not lost mid-press.
	const onSpeakerClickRef = useLatest(onSpeakerClick)
	const onTimeClickRef = useLatest(onTimeClick)
	const recordingMarkdownRemarkPlugin = useMemo(
		() => createRecordingMarkdownRemarkPlugin(speakerNameMap),
		[speakerNameMap],
	)
	const components = useMemo(
		() =>
			createRecordingMarkdownComponents({
				onSpeakerClick: (speakerId) => onSpeakerClickRef.current?.(speakerId),
				onTimeClick: (seconds) => onTimeClickRef.current?.(seconds),
				speakerNameMap,
				timeLinkTestId,
				speakerLinkTestId,
				attachments,
				relativeFilePath,
			}),
		[
			onSpeakerClickRef,
			onTimeClickRef,
			speakerLinkTestId,
			speakerNameMap,
			timeLinkTestId,
			attachments,
			relativeFilePath,
		],
	)

	return (
		<div
			className={cn(
				"recording-md-prose",
				layout === "mobile" ? "recording-md-prose--mobile" : "recording-md-prose--desktop",
				className,
			)}
			data-testid="recording-detail-markdown-content"
			data-layout={layout}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, recordingMarkdownRemarkPlugin]}
				rehypePlugins={RECORDING_MARKDOWN_REHYPE_PLUGINS}
				urlTransform={(url) => url}
				components={components}
			>
				{content}
			</ReactMarkdown>
		</div>
	)
}
