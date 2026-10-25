import {
	useEffect,
	useMemo,
	useState,
	Suspense,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from "react"
import { AlignLeft, Network } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ScrollEdgeFadeContainer } from "@/components/base-mobile/ScrollEdgeFade"
import { cn } from "@/utils/cn"
import MagicMarkmap from "@/components/base/MagicMarkmap"
import IsolatedHTMLRenderer from "@/pages/superMagic/components/Detail/contents/HTML/IsolatedHTMLRenderer"
import { RecordingTokenText } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingTokenText"
import { useRecordingMetricsHtml } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingMetricsHtml"
import MagicSpin from "@/components/base/MagicSpin"
import type { RecordingDetailFileRef, RecordingTopicSection } from "../types"
import { parseTopicsMarkdown } from "../utils/topics-parser"
import { formatRecordingTime } from "../utils/time"
import { resolveMarkdownSpeakerLabels } from "../utils/markdown-time-links"
import { MobileRecordingMarkdownContent } from "./MobileRecordingMarkdownContent"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

interface MobileRecordingSummaryPanelProps {
	summaryFiles: RecordingDetailFileRef[]
	summaryContent: Record<string, string | undefined>
	attachmentList: AttachmentItem[]
	scrollPaddingBottom: CSSProperties["paddingBottom"]
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
	onContentScroll?: () => void
	searchScopeRef?: RefObject<HTMLDivElement | null>
	searchActive?: boolean
	onActiveTypeChange?: (type: string) => void
	/** Hides the nested summary switcher when an embedding preview owns the tab row. */
	showTypeTabs?: boolean
	activeType?: string
	isGenerating?: boolean
}

/** Renders dynamic completed-summary tabs from the project file map. */
export function MobileRecordingSummaryPanel({
	summaryFiles,
	summaryContent,
	attachmentList,
	scrollPaddingBottom,
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
	onContentScroll,
	searchScopeRef,
	searchActive = false,
	onActiveTypeChange,
	showTypeTabs = true,
	activeType: controlledActiveType,
	isGenerating = false,
}: MobileRecordingSummaryPanelProps) {
	const { t } = useTranslation("audioRecordings")
	const [activeType, setActiveType] = useState<string>(summaryFiles[0]?.type ?? "")
	const resolvedActiveType = controlledActiveType ?? activeType
	const activeFile =
		summaryFiles.find((file) => file.type === resolvedActiveType) ?? summaryFiles[0]
	const content = activeFile ? summaryContent[activeFile.type] : undefined

	useEffect(() => {
		onActiveTypeChange?.(activeFile?.type ?? "")
	}, [activeFile?.type, onActiveTypeChange])

	if (summaryFiles.length === 0) {
		return (
			<div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground">
				{t("detail.emptySummary")}
			</div>
		)
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="mobile-recording-summary-panel">
			{/* Match the source tab header height so switching between Source and Summary never shifts content vertically. */}
			{showTypeTabs ? (
				<div className="sticky top-0 z-10 flex min-h-[68px] items-center overflow-x-auto bg-[#f7f7f8] px-4 py-3">
					<div className="flex w-max">
						{summaryFiles.map((file) => (
							<SummaryTabButton
								key={file.type}
								active={file.type === activeFile?.type}
								label={resolveSummaryTypeLabel(file.type, t)}
								type={file.type}
								onClick={() => {
									setActiveType(file.type)
									onActiveTypeChange?.(file.type)
								}}
							/>
						))}
					</div>
				</div>
			) : null}

			{/*
			 * metrics tab: render directly in the panel's flex column so that flex-1
			 * can properly stretch the iframe to fill remaining height.
			 * Placing it inside an overflow-y-auto scroll port breaks the flex height
			 * chain because the scroll container expands to content height, so
			 * flex-1 children can never resolve a finite "remaining" height.
			 */}
			{activeFile?.type === "metrics" ? (
				<div
					className="flex min-h-0 flex-1 flex-col overflow-hidden px-4"
					style={{ paddingBottom: scrollPaddingBottom }}
				>
					{content?.trim() ? (
						<MetricsHtmlContent
							file={activeFile}
							content={content}
							attachmentList={attachmentList}
						/>
					) : (
						<PanelMessage>
							{isGenerating ? t("detail.summarizingHint") : t("detail.emptySummary")}
						</PanelMessage>
					)}
				</div>
			) : (
				/* All other tab types go through the scroll container with edge fade */
				<ScrollEdgeFadeContainer
					fadeColor="mobile-background"
					className="min-h-0 flex-1"
					scrollClassName="px-4"
					contentDeps={[activeType, summaryFiles.length, Boolean(content?.trim())]}
					onScroll={onContentScroll}
				>
					<div
						ref={searchScopeRef}
						data-search-scope="mobile-recording-summary"
						className="flex min-h-full flex-col"
						style={{ paddingBottom: scrollPaddingBottom }}
					>
						{activeFile ? (
							<SummaryContent
								file={activeFile}
								content={content}
								attachmentList={attachmentList}
								emptyText={
									isGenerating
										? t("detail.summarizingHint")
										: t("detail.emptySummary")
								}
								scrollPaddingBottom={scrollPaddingBottom}
								searchActive={searchActive}
								speakerNameMap={speakerNameMap}
								onOpenSpeakerSettings={onOpenSpeakerSettings}
								onTimeClick={onTimeClick}
							/>
						) : null}
					</div>
				</ScrollEdgeFadeContainer>
			)}
		</div>
	)
}

/** Compact text-only tab button matching the prototype's second-level pill row. */
function SummaryTabButton({
	active,
	label,
	type,
	onClick,
}: {
	active: boolean
	label: string
	type: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			className={cn(
				"relative z-10 inline-flex h-8 shrink-0 items-center rounded-full px-5 text-[14px] font-medium leading-none transition-colors",
				active
					? "bg-foreground text-background shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
					: "text-muted-foreground",
			)}
			onClick={onClick}
			data-testid={`mobile-recording-summary-tab-${type}`}
		>
			{label}
		</button>
	)
}

/** Selects the renderer for each supported completed-summary file type. */
function SummaryContent({
	file,
	content,
	attachmentList,
	emptyText,
	scrollPaddingBottom,
	searchActive,
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
}: {
	file: RecordingDetailFileRef
	content?: string
	attachmentList: AttachmentItem[]
	emptyText: string
	scrollPaddingBottom: CSSProperties["paddingBottom"]
	searchActive: boolean
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
}) {
	if (!file.file || !content?.trim()) {
		return <PanelMessage>{emptyText}</PanelMessage>
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
				searchActive={searchActive}
				speakerNameMap={speakerNameMap}
				onOpenSpeakerSettings={onOpenSpeakerSettings}
				onTimeClick={onTimeClick}
			/>
		)
	}

	return (
		<div className="pb-8">
			<MobileRecordingMarkdownContent
				content={content}
				layout="mobile"
				speakerNameMap={speakerNameMap}
				onSpeakerClick={onOpenSpeakerSettings}
				onTimeClick={(time) => onTimeClick(time)}
			/>
		</div>
	)
}

/** Reuses the shared HTML processor and isolated iframe renderer for metrics summaries so bundle-relative assets keep working. */
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
			data-testid="mobile-recording-metrics-container"
		>
			{/* Keep IsolatedHTMLRenderer inside a local Suspense so a suspend cannot
			    bubble to the route LoadingFallback and blank the host page. */}
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
					data-testid="mobile-recording-metrics-loading"
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

/** Mobile mind map view with draggable map mode and markdown fallback mode. */
function MindmapContent({
	content,
	scrollPaddingBottom,
	searchActive,
	speakerNameMap,
	onOpenSpeakerSettings,
	onTimeClick,
}: {
	content: string
	scrollPaddingBottom: CSSProperties["paddingBottom"]
	searchActive: boolean
	speakerNameMap: Record<string, string>
	onOpenSpeakerSettings: () => void
	onTimeClick: (seconds: number, end?: number) => void
}) {
	const [viewMode, setViewMode] = useState<"map" | "markdown">("map")

	useEffect(() => {
		if (searchActive) setViewMode("markdown")
	}, [searchActive])
	const mindmapCanvasContent = useMemo(
		() => resolveMarkdownSpeakerLabels(content, speakerNameMap),
		[content, speakerNameMap],
	)
	// Keep the mobile recording detail mindmap background aligned with the prototype:
	// this page needs a clean solid canvas, while other markmap scenes can keep their dotted default.
	const mobileMindmapCanvasClassName =
		"h-full min-h-[520px] bg-[#f7f7f8] [&_svg]:bg-[#f7f7f8] [&_svg]:[background-image:none]"

	return (
		<div
			className="-mx-4 -mt-3 min-h-[calc(100dvh-300px)] bg-[#f7f7f8]"
			data-testid="mobile-recording-mindmap"
		>
			{viewMode === "map" ? (
				<div className="relative h-[calc(100dvh-300px)] min-h-[520px] overflow-hidden bg-[#f7f7f8]">
					<MagicMarkmap
						data={mindmapCanvasContent}
						fullScreen
						showTitle={false}
						showToolBar={false}
						className={mobileMindmapCanvasClassName}
					/>
					<MindmapViewSwitch
						value={viewMode}
						bottom={scrollPaddingBottom}
						onChange={setViewMode}
					/>
				</div>
			) : (
				<div className="relative px-4 pb-8 pt-3">
					<MobileRecordingMarkdownContent
						content={content}
						layout="mobile"
						speakerNameMap={speakerNameMap}
						onSpeakerClick={onOpenSpeakerSettings}
						onTimeClick={(time) => onTimeClick(time)}
					/>
					<MindmapViewSwitch
						value={viewMode}
						bottom={scrollPaddingBottom}
						onChange={setViewMode}
					/>
				</div>
			)}
		</div>
	)
}

/** Floating switch used by the mindmap tab to toggle between map and markdown text. */
function MindmapViewSwitch({
	value,
	bottom,
	onChange,
}: {
	value: "map" | "markdown"
	bottom: CSSProperties["bottom"]
	onChange: (value: "map" | "markdown") => void
}) {
	const { t } = useTranslation("audioRecordings")

	return (
		<div
			className="fixed right-4 z-20 inline-flex rounded-2xl bg-card p-1 shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
			style={{ bottom }}
			data-search-exclude="true"
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

/** Renders the structured chapter-topic summary cards from topics markdown. */
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
	const activeTopic = useMemo(
		() => topics.find((topic) => topic.id === activeTopicId) ?? topics[0],
		[activeTopicId, topics],
	)

	if (topics.length === 0 || !activeTopic) {
		return <PanelMessage>{t("detail.emptySummary")}</PanelMessage>
	}

	return (
		<div className="flex flex-col gap-4" data-testid="mobile-recording-topics-content">
			<div className="-mx-4 overflow-x-auto px-4">
				<div className="flex w-max gap-2">
					{topics.map((topic) => {
						const isActive = topic.id === activeTopic.id
						return (
							<button
								key={topic.id}
								type="button"
								className={cn(
									"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[14px] font-medium leading-none transition-colors",
									isActive
										? "border-foreground bg-foreground text-background"
										: "border-border bg-card/70 text-muted-foreground",
								)}
								onClick={() => setActiveTopicId(topic.id)}
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
										className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground active:opacity-70"
										onClick={onOpenSpeakerSettings}
									>
										{speakerNameMap[speaker] ?? speaker}
									</button>
								))}
							</div>
						) : null}
						<MobileRecordingMarkdownContent
							content={activeTopic.summaryText}
							layout="mobile"
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
									className="rounded-xl bg-card/80 px-3 py-2.5 text-left shadow-[0_4px_16px_rgba(0,0,0,0.03)] active:bg-muted"
									onClick={() => onTimeClick(item.time, item.timeEnd)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault()
											onTimeClick(item.time, item.timeEnd)
										}
									}}
									data-testid="mobile-recording-topic-time-card"
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

/** Lightweight empty/error message panel for individual summary tabs. */
function PanelMessage({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
			{children}
		</div>
	)
}

/** Resolves summary tab labels with literal i18n keys so locale tooling can statically discover every entry. */
function resolveSummaryTypeLabel(type: string, t: ReturnType<typeof useTranslation>["t"]) {
	if (type === "summary") return t("detail.tabs.summary")
	if (type === "topics") return t("detail.tabs.topics")
	if (type === "highlights") return t("detail.tabs.highlights")
	if (type === "insights") return t("detail.tabs.insights")
	if (type === "metrics") return t("detail.tabs.metrics")
	if (type === "mindmap") return t("detail.tabs.mindmap")
	if (type === "followup") return t("detail.tabs.followup")
	if (type === "power_dynamics") return t("detail.tabs.powerDynamics")
	if (type === "intent") return t("detail.tabs.intent")
	return type
}
