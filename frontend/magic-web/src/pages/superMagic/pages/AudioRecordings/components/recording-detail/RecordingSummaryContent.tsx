import { useEffect, useMemo, useRef, useState, Suspense } from "react"
import { AlignLeft, Network } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import MagicMarkmap from "@/components/base/MagicMarkmap"
import IsolatedHTMLRenderer from "@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer"
import type { RecordingDetailFileRef, RecordingTopicSection } from "../../types/recording-detail"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { parseTopicsMarkdown } from "../../utils/topics-parser"
import { formatRecordingTime } from "../../utils/time"
import { resolveMarkdownSpeakerLabels } from "../../utils/markdownTimeLinks"
import {
	RECORDING_DESKTOP_CONTENT_INSET_CLASS,
	RECORDING_DESKTOP_MD_CONTENT_CLASS,
} from "./recording-detail-layout"
import { RecordingMarkdownContent } from "./RecordingMarkdownContent"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { RecordingDetailEmptyState } from "./RecordingDetailEmptyState"
import { RecordingDetailRegionEmptySlot } from "./RecordingDetailRegionEmptySlot"
import {
	centerHorizontalItemInContainer,
	useHorizontalScrollWithFade,
} from "../../hooks/useHorizontalScrollWithFade"
import { RecordingTokenText } from "./RecordingTokenText"
import { useRecordingMetricsHtml } from "../../hooks/useRecordingMetricsHtml"
import MagicSpin from "@/components/base/MagicSpin"

export interface RecordingSummaryContentProps {
	file: RecordingDetailFileRef
	content?: string
	attachmentList: AttachmentItem[]
	attachmentTree?: AttachmentFile[]
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
	scrollPaddingBottom?: number
	layout?: "desktop" | "mobile"
	isGenerating?: boolean
}

/** Selects the renderer for each supported completed-summary file type. */
export function RecordingSummaryContent({
	file,
	content,
	attachmentList,
	attachmentTree = [],
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
	scrollPaddingBottom = 0,
	layout = "desktop",
	isGenerating = false,
}: RecordingSummaryContentProps) {
	if (!file.file || !content?.trim()) {
		return <SummaryTabEmptyState isGenerating={isGenerating} />
	}

	if (file.type === "metrics") {
		return <MetricsHtmlContent file={file} content={content} attachmentList={attachmentList} />
	}

	if (file.type === "topics") {
		return (
			<TopicsContent
				topics={parseTopicsMarkdown(content)}
				speakerNameMap={speakerNameMap}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
				onTimeClick={onTimeClick}
			/>
		)
	}

	if (file.type === "mindmap") {
		return (
			<MindmapContent
				content={content}
				scrollPaddingBottom={scrollPaddingBottom}
				speakerNameMap={speakerNameMap}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
				onTimeClick={onTimeClick}
				layout={layout}
				attachments={attachmentTree}
				relativeFilePath={file.file.relative_file_path ?? file.file.path}
			/>
		)
	}

	return (
		<div className={RECORDING_DESKTOP_MD_CONTENT_CLASS}>
			<RecordingMarkdownContent
				content={content}
				layout={layout}
				attachments={attachmentTree}
				relativeFilePath={file.file.relative_file_path ?? file.file.path}
				speakerNameMap={speakerNameMap}
				onSpeakerClick={onOpenSpeakerSettings}
				onTimeClick={(time) => onTimeClick(time)}
			/>
		</div>
	)
}

/** Renders the metrics HTML preview and keeps a generic loading mask until the iframe is ready. */
function MetricsHtmlContent({
	file,
	content,
	attachmentList,
}: {
	file: RecordingDetailFileRef
	content: string
	attachmentList: AttachmentItem[]
}) {
	const { t } = useTranslation("audioRecordings")
	const { processedContent, filePathMapping, isLoading, handleRenderReady } =
		useRecordingMetricsHtml({
			content,
			attachmentList,
			fileId: file.file.file_id,
			fileName: file.fileName,
		})

	return (
		<div
			className="relative flex min-h-0 flex-1 flex-col"
			aria-busy={isLoading}
			data-testid="recording-detail-metrics-container"
		>
			{/* Keep IsolatedHTMLRenderer inside a local Suspense: it is a huge tree, and
			    any suspend bubbles to the route LoadingFallback (FullSpin) which blanks
			    the whole outlet while the app sidebar stays. The local overlay already
			    covers metrics loading. */}
			{processedContent ? (
				<Suspense fallback={null}>
					<IsolatedHTMLRenderer
						content={processedContent}
						fileId={file.file.file_id}
						filePathMapping={filePathMapping}
						attachmentList={attachmentList}
						relative_file_path={file.file.relative_file_path}
						openNewTab={() => undefined}
						className="flex min-h-[520px] flex-1 overflow-hidden rounded-2xl bg-card"
						iframeClassName="h-full min-h-[520px] bg-white"
						onRenderReady={handleRenderReady}
					/>
				</Suspense>
			) : null}
			{isLoading ? (
				<div
					className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-card/80"
					data-testid="recording-detail-metrics-loading"
					role="status"
					aria-live="polite"
				>
					{/* Metrics HTML is already inside the detail page; use the generic loading copy. */}
					<MagicSpin spinning tip={t("loading")} />
				</div>
			) : null}
		</div>
	)
}

/**
 * Desktop markdown scroll safe inset — reserves space for the bottom-left view switch
 * (bottom-4 + ~80px wide control + left-4 offset) so list text is not obscured.
 */
const DESKTOP_MINDMAP_MARKDOWN_SCROLL_CLASS =
	"absolute inset-0 overflow-y-auto pt-1 pr-1 pb-20 pl-28"

function MindmapContent({
	content,
	scrollPaddingBottom,
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
	layout,
	attachments,
	relativeFilePath,
}: {
	content: string
	scrollPaddingBottom: number
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
	layout: "desktop" | "mobile"
	attachments?: AttachmentFile[]
	relativeFilePath?: string
}) {
	const [viewMode, setViewMode] = useState<"map" | "markdown">("map")
	const isDesktop = layout === "desktop"
	const mindmapCanvasContent = useMemo(
		() => resolveMarkdownSpeakerLabels(content, speakerNameMap),
		[content, speakerNameMap],
	)
	const canvasClassName = isDesktop
		? "!h-full min-h-0 bg-white [&_svg]:bg-white [&_svg]:[background-image:none]"
		: "h-full min-h-[480px] bg-white [&_svg]:bg-white [&_svg]:[background-image:none]"

	if (isDesktop) {
		return (
			<div className="relative h-full min-h-0" data-testid="recording-detail-mindmap">
				{viewMode === "map" ? (
					<div className="absolute inset-0 overflow-hidden rounded-xl bg-white">
						<MagicMarkmap
							data={mindmapCanvasContent}
							fullScreen
							showTitle={false}
							showToolBar={false}
							className={canvasClassName}
						/>
					</div>
				) : (
					<div className={DESKTOP_MINDMAP_MARKDOWN_SCROLL_CLASS}>
						<RecordingMarkdownContent
							content={content}
							layout={layout}
							speakerNameMap={speakerNameMap}
							onSpeakerClick={onOpenSpeakerSettings}
							onTimeClick={(time) => onTimeClick(time)}
							attachments={attachments}
							relativeFilePath={relativeFilePath}
						/>
					</div>
				)}
				<MindmapViewSwitch value={viewMode} onChange={setViewMode} layout={layout} />
			</div>
		)
	}

	return (
		<div className="relative min-h-[480px]" data-testid="recording-detail-mindmap">
			{viewMode === "map" ? (
				<div className="relative h-[min(560px,calc(100vh-280px))] min-h-[480px] overflow-hidden rounded-xl bg-white">
					<MagicMarkmap
						data={mindmapCanvasContent}
						fullScreen
						showTitle={false}
						showToolBar={false}
						className={canvasClassName}
					/>
					<MindmapViewSwitch
						value={viewMode}
						bottom={scrollPaddingBottom}
						onChange={setViewMode}
						layout={layout}
					/>
				</div>
			) : (
				<div className="relative px-1 pb-8 pt-1">
					<RecordingMarkdownContent
						content={content}
						layout={layout}
						speakerNameMap={speakerNameMap}
						onSpeakerClick={onOpenSpeakerSettings}
						onTimeClick={(time) => onTimeClick(time)}
						attachments={attachments}
						relativeFilePath={relativeFilePath}
					/>
					<MindmapViewSwitch
						value={viewMode}
						bottom={scrollPaddingBottom}
						onChange={setViewMode}
						layout={layout}
					/>
				</div>
			)}
		</div>
	)
}

function MindmapViewSwitch({
	value,
	bottom = 0,
	onChange,
	layout,
}: {
	value: "map" | "markdown"
	bottom?: number
	onChange: (value: "map" | "markdown") => void
	layout: "desktop" | "mobile"
}) {
	const { t } = useTranslation("audioRecordings")
	const positionClass =
		layout === "mobile" ? "fixed right-4 z-20" : "absolute bottom-4 left-4 z-20"

	return (
		<div
			className={cn(
				positionClass,
				"inline-flex rounded-2xl bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.14)]",
			)}
			style={layout === "mobile" ? { bottom } : undefined}
		>
			<button
				type="button"
				className={cn(
					"flex size-9 items-center justify-center rounded-xl",
					value === "map" ? "bg-foreground text-background" : "text-foreground",
				)}
				aria-label={t("detail.showMindmap")}
				onClick={() => onChange("map")}
			>
				<Network className="size-4" />
			</button>
			<button
				type="button"
				className={cn(
					"flex size-9 items-center justify-center rounded-xl",
					value === "markdown" ? "bg-foreground text-background" : "text-foreground",
				)}
				aria-label={t("detail.showMarkdown")}
				onClick={() => onChange("markdown")}
			>
				<AlignLeft className="size-4" />
			</button>
		</div>
	)
}

function TopicsContent({
	topics,
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
}: {
	topics: RecordingTopicSection[]
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
}) {
	const { t } = useTranslation("audioRecordings")
	const [activeTopicId, setActiveTopicId] = useState(topics[0]?.id ?? "")
	const topicRefs = useRef<Partial<Record<string, HTMLButtonElement>>>({})
	const { scrollRef, canScrollStart, canScrollEnd, refreshFadeState } =
		useHorizontalScrollWithFade<HTMLDivElement>()
	const activeTopic = useMemo(
		() => topics.find((topic) => topic.id === activeTopicId) ?? topics[0],
		[activeTopicId, topics],
	)

	// Recompute edge fades when topic list width changes.
	useEffect(() => {
		refreshFadeState()
	}, [refreshFadeState, topics])

	// Keep the active topic pill visible when the strip overflows horizontally.
	useEffect(() => {
		const activeButton = topicRefs.current[activeTopicId]
		const bar = scrollRef.current
		if (!activeButton || !bar) return
		centerHorizontalItemInContainer(bar, activeButton)
	}, [activeTopicId, scrollRef])

	if (topics.length === 0 || !activeTopic) {
		return <SummaryTabEmptyState />
	}

	return (
		<div
			className={cn(RECORDING_DESKTOP_CONTENT_INSET_CLASS, "flex flex-col gap-4 pb-8")}
			data-testid="recording-detail-topics-content"
		>
			<div className="relative -mx-1 min-w-0 overflow-hidden">
				<div
					ref={scrollRef}
					className="no-scrollbar overflow-x-auto"
					data-testid="recording-detail-topics-scroll"
				>
					<div className="flex w-max flex-nowrap gap-2">
						{topics.map((topic) => {
							const isActive = topic.id === activeTopic.id
							return (
								<button
									key={topic.id}
									ref={(element) => {
										topicRefs.current[topic.id] = element ?? undefined
									}}
									type="button"
									className={cn(
										"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium leading-none transition-colors",
										isActive
											? "border-foreground bg-foreground text-background"
											: "border-border bg-card/70 text-muted-foreground",
									)}
									onClick={() => setActiveTopicId(topic.id)}
									data-testid={`recording-detail-topic-pill-${topic.id}`}
								>
									{/* Chapter color dot reuses the per-topic color so tabs stay visually distinct, matching the legacy HTML tab dots. */}
									<span
										aria-hidden
										className={cn(
											"size-2 shrink-0 rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/25",
											isActive && "ring-white/40 dark:ring-black/30",
										)}
										style={{ backgroundColor: topic.color }}
									/>
									{topic.name}
								</button>
							)
						})}
					</div>
				</div>

				{canScrollStart ? (
					<div
						className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card from-40% via-card/90 to-transparent"
						data-testid="recording-detail-topics-fade-start"
						aria-hidden
					/>
				) : null}

				{canScrollEnd ? (
					<div
						className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-card from-40% via-card/90 to-transparent"
						data-testid="recording-detail-topics-fade-end"
						aria-hidden
					/>
				) : null}
			</div>

			<div>
				{activeTopic.summaryText ? (
					<section>
						<h3 className="mb-3 text-[16px] font-semibold leading-6 text-foreground">
							{activeTopic.summaryTitle || t("detail.topicSummary")}
						</h3>
						{activeTopic.summarySpeakers.length > 0 ? (
							<div className="mb-3 flex flex-wrap gap-1.5">
								{activeTopic.summarySpeakers.map((speaker) => (
									<button
										type="button"
										key={speaker}
										className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:opacity-80"
										onClick={onOpenSpeakerSettings}
									>
										{speakerNameMap[speaker] ?? speaker}
									</button>
								))}
							</div>
						) : null}
						<RecordingMarkdownContent
							content={activeTopic.summaryText}
							layout="desktop"
							speakerNameMap={speakerNameMap}
							onSpeakerClick={onOpenSpeakerSettings}
							onTimeClick={(time) => onTimeClick(time)}
						/>
					</section>
				) : null}

				{activeTopic.items.length > 0 ? (
					<section className="mt-6">
						<h3 className="mb-3 text-[16px] font-semibold leading-6 text-foreground">
							{activeTopic.itemsTitle || t("detail.relatedDialogue")}
						</h3>
						<div className="flex flex-col gap-2">
							{activeTopic.items.map((item) => (
								<div
									key={`${item.time}-${item.text}`}
									role="button"
									tabIndex={0}
									className="rounded-xl bg-card/80 px-3 py-2.5 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:bg-muted"
									onClick={() => onTimeClick(item.time, item.timeEnd)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault()
											onTimeClick(item.time, item.timeEnd)
										}
									}}
									data-testid="recording-detail-topic-time-card"
								>
									<div className="mb-1 flex flex-wrap items-center gap-1.5">
										<span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">
											{formatRecordingTime(item.time)}
											{item.timeEnd
												? `-${formatRecordingTime(item.timeEnd)}`
												: ""}
										</span>
										{item.speakers.map((speaker) => (
											<span
												key={speaker}
												className="rounded-full px-2 py-0.5 text-[11px] text-muted-foreground"
											>
												{speakerNameMap[speaker] ?? speaker}
											</span>
										))}
									</div>
									<p className="text-[13px] leading-5 text-foreground">
										<RecordingTokenText
											text={item.text}
											speakerNameMap={speakerNameMap}
											onSpeakerClick={onOpenSpeakerSettings}
											onTimeClick={(time) => onTimeClick(time)}
										/>
									</p>
								</div>
							))}
						</div>
					</section>
				) : null}
			</div>
		</div>
	)
}

/** Centered empty placeholder for summary tabs whose file content is not yet available. */
function SummaryTabEmptyState({ isGenerating }: { isGenerating: boolean }) {
	return (
		<RecordingDetailRegionEmptySlot>
			<RecordingDetailEmptyState
				variant={isGenerating ? "summaryGenerating" : "noSummaryFile"}
				compact
			/>
		</RecordingDetailRegionEmptySlot>
	)
}
