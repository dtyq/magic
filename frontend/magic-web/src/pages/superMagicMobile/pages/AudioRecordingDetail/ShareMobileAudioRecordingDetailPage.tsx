import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MoreHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import Logo from "@/layouts/BaseLayout/components/Header/components/Logo"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { useShareRecordingDetailData } from "@/pages/superMagic/pages/AudioRecordings/hooks/useShareRecordingDetailData"
import { hasConfiguredRecordingFile } from "@/pages/superMagic/pages/AudioRecordings/utils/recording-detail-files"
import { useRecordingColorSegments } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingColorSegments"
import { downloadRecordingAudioFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio"
import { normalizeSpeakerSelection } from "@/pages/superMagic/pages/AudioRecordings/utils/speaker-filter"
import { MobileRecordingAudioPlayer } from "./components/MobileRecordingAudioPlayer"
import { MobileRecordingSourcePanel } from "./components/MobileRecordingSourcePanel"
import { MobileRecordingSummaryPanel } from "./components/MobileRecordingSummaryPanel"
import { MobileRecordingShareExportSheet } from "./components/MobileRecordingShareExportSheet"
import { useMobileRecordingAudioPlayer } from "./hooks/useMobileRecordingAudioPlayer"
import type { MobileRecordingSourceTab, MobileRecordingTopTab } from "./types"
import { collectSpeakerIdsFromText } from "./utils/markdown-time-links"
import MobileBottomSearchBar from "@/pages/superMagicMobile/components/MobileBottomSearchBar"
import { useMobileRecordingContentSearch } from "./hooks/useMobileRecordingContentSearch"
import {
	getMobileRecordingPlayerScrollPadding,
	MOBILE_RECORDING_COLLAPSED_PLAYER_HEIGHT,
	MOBILE_RECORDING_EXPANDED_PLAYER_HEIGHT,
} from "./utils/mobile-recording-player-layout"

const SHARE_PAGE_BOTTOM_READABLE_GAP = 24
const SHARE_SEARCH_BAR_HEIGHT = 72
const SHARE_SEARCH_WATERMARK_GAP = 44

interface ShareMobileAudioRecordingDetailPageProps {
	projectId: string
	resourceName?: string
	allowDownloadProjectFile: boolean
	showCopyProject?: boolean
	copyProjectLabel?: string
	showLogin?: boolean
	loginLabel?: string
	onCopyProject?: () => void
	onLogin?: () => void
	attachments: {
		tree: AttachmentItem[]
		list: AttachmentItem[]
	}
	onPlayerExpandedChange?: (expanded: boolean) => void
}

/** Renders the H5 read-only recording detail experience inside the share route container. */
export default function ShareMobileAudioRecordingDetailPage({
	projectId,
	resourceName,
	allowDownloadProjectFile,
	showCopyProject = false,
	copyProjectLabel,
	showLogin = false,
	loginLabel,
	onCopyProject,
	onLogin,
	attachments,
	onPlayerExpandedChange,
}: ShareMobileAudioRecordingDetailPageProps) {
	const { t } = useTranslation("audioRecordings")
	const { loading, error, fileMap, texts, audioUrl, title, attachmentList } =
		useShareRecordingDetailData({
			projectId,
			resourceName,
			attachments,
		})
	const player = useMobileRecordingAudioPlayer(audioUrl)
	const [activeTab, setActiveTab] = useState<MobileRecordingTopTab>("summary")
	const [playerExpanded, setPlayerExpanded] = useState(false)
	const [shareExportSheetOpen, setShareExportSheetOpen] = useState(false)
	const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
	const [contentSearchOpen, setContentSearchOpen] = useState(false)
	const [contentSearchQuery, setContentSearchQuery] = useState("")
	const [sourceSubtab, setSourceSubtab] = useState<MobileRecordingSourceTab>("transcript")
	const [summaryType, setSummaryType] = useState("")
	const searchScopeRef = useRef<HTMLDivElement | null>(null)
	const summaryReady = Boolean(fileMap?.summaryFiles.length)
	const displayTitle = title || resourceName || t("detail.untitled")
	const summaryContent = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(texts.summary).map(([key, value]) => [key, value?.content]),
			),
		[texts.summary],
	)
	const speakerNameMap = fileMap?.magicProjectConfig?.metadata?.speakers ?? {}
	const transcriptSpeakerIds = useMemo(
		() =>
			Array.from(
				new Set(
					texts.transcript?.content
						? collectSpeakerIdsFromText(texts.transcript.content)
						: [],
				),
			),
		[texts.transcript?.content],
	)
	const effectiveSelectedSpeakerIds = useMemo(
		() => normalizeSpeakerSelection(transcriptSpeakerIds, selectedSpeakerIds),
		[selectedSpeakerIds, transcriptSpeakerIds],
	)
	const searchSupported = !(activeTab === "summary" && summaryType === "metrics")
	const contentSearch = useMobileRecordingContentSearch(contentSearchQuery, {
		scopeRef: searchScopeRef,
		enabled: contentSearchOpen && searchSupported,
		contentKey: `${projectId}:${activeTab}:${sourceSubtab}:${summaryType}:${selectedSpeakerIds.join(",")}:${texts.transcript?.content?.length ?? 0}:${Object.values(
			texts.summary,
		)
			.map((file) => file?.content?.length ?? 0)
			.join(",")}`,
	})
	const activePlayerHeight = playerExpanded
		? MOBILE_RECORDING_EXPANDED_PLAYER_HEIGHT
		: MOBILE_RECORDING_COLLAPSED_PLAYER_HEIGHT
	const scrollPaddingBottom = contentSearchOpen
		? SHARE_SEARCH_BAR_HEIGHT + SHARE_SEARCH_WATERMARK_GAP + SHARE_PAGE_BOTTOM_READABLE_GAP
		: getMobileRecordingPlayerScrollPadding(
				activePlayerHeight,
				20 +
					// Reserve extra reading room for the share footer so the last lines stay above the floating player.
					SHARE_PAGE_BOTTOM_READABLE_GAP,
			)
	const colorSegments = useRecordingColorSegments(summaryReady, texts.summary.topics?.content)

	/** Keeps the outer share watermark aligned with the inner player's expanded height. */
	const handlePlayerExpandedChange = useCallback(
		(expanded: boolean) => {
			setPlayerExpanded(expanded)
			onPlayerExpandedChange?.(expanded)
		},
		[onPlayerExpandedChange],
	)

	/** Keeps readonly share filtering session-local while still allowing transcript inspection controls. */
	function handleSelectedSpeakerIdsChange(speakerIdsToSelect: string[]) {
		setSelectedSpeakerIds(speakerIdsToSelect)
	}

	/** Sends mobile summary time chips to the shared player without leaving the current top-level tab. */
	function handleSummaryTimeClick(start: number, end?: number) {
		player.playSegment({ start, end })
	}

	/** Opens the readonly action sheet even when download permission is disabled. */
	function openShareExportSheet() {
		setShareExportSheetOpen(true)
		handlePlayerExpandedChange(false)
	}

	/** Opens readonly content search while preserving the current audio playback session. */
	const openContentSearch = useCallback(() => {
		if (!searchSupported) return
		setContentSearchOpen(true)
		handlePlayerExpandedChange(false)
	}, [handlePlayerExpandedChange, searchSupported])

	/** Exits readonly content search and clears its session-local query. */
	const closeContentSearch = useCallback(() => {
		setContentSearchOpen(false)
		setContentSearchQuery("")
		handlePlayerExpandedChange(false)
	}, [handlePlayerExpandedChange])

	useEffect(() => {
		if (!searchSupported && contentSearchOpen) closeContentSearch()
	}, [closeContentSearch, contentSearchOpen, searchSupported])

	/** Downloads the original audio file from the readonly share bundle. */
	async function handleDownloadRecording() {
		await downloadRecordingAudioFile({
			fileId: fileMap?.audio?.file_id,
			audioFile: fileMap?.audio,
			fallbackName: `${title || "recording"}_audio`,
		})
	}

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				{t("detail.loading")}
			</div>
		)
	}

	if (error) {
		return (
			<div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
				{t("detail.loadFailed")}
			</div>
		)
	}

	return (
		<div
			className="flex h-full min-h-0 flex-col bg-[#f7f7f8]"
			data-testid="mobile-recording-share-page"
		>
			<ShareMobileRecordingHeader
				activeTab={activeTab}
				onOpenMore={openShareExportSheet}
				onTabChange={setActiveTab}
			/>

			{/* Keep the title below the compact segmented header so the share container chrome never forces the tabs onto a second row. */}
			<div className="border-b border-border/60 bg-[#f7f7f8] px-4 pb-3 pt-2">
				<h1
					className="truncate text-[18px] font-semibold leading-6 text-foreground"
					style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
					title={displayTitle}
				>
					{displayTitle}
				</h1>
			</div>

			{/* Establish a finite flex column so the panel's sole inner scroll port can resolve its height. */}
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{activeTab === "source" ? (
					<MobileRecordingSourcePanel
						transcriptContent={texts.transcript?.content}
						notesContent={texts.notes?.content}
						playing={player.playing}
						currentTime={player.currentTime}
						scrollPaddingBottom={scrollPaddingBottom}
						availableSpeakerIds={transcriptSpeakerIds}
						selectedSpeakerIds={effectiveSelectedSpeakerIds}
						speakerNameMap={speakerNameMap}
						onSelectedSpeakerIdsChange={handleSelectedSpeakerIdsChange}
						onOpenSpeakerSettings={() => undefined}
						onSeek={(seconds) => player.seekTo(seconds)}
						searchScopeRef={searchScopeRef}
						onActiveTabChange={setSourceSubtab}
						showNotesTab={
							hasConfiguredRecordingFile(fileMap, "notes") &&
							Boolean(fileMap?.notes?.file_id)
						}
					/>
				) : (
					<MobileRecordingSummaryPanel
						summaryFiles={fileMap?.summaryFiles ?? []}
						summaryContent={summaryContent}
						attachmentList={attachmentList}
						scrollPaddingBottom={scrollPaddingBottom}
						speakerNameMap={speakerNameMap}
						onOpenSpeakerSettings={() => undefined}
						onTimeClick={handleSummaryTimeClick}
						searchScopeRef={searchScopeRef}
						searchActive={contentSearchOpen}
						onActiveTypeChange={setSummaryType}
					/>
				)}
			</div>

			<MobileRecordingAudioPlayer
				audioRef={player.audioRef}
				audioUrl={audioUrl}
				currentSec={player.currentTime}
				duration={player.duration}
				playing={player.playing}
				expanded={playerExpanded}
				playbackRate={player.playbackRate}
				colorSegments={colorSegments}
				onToggle={player.toggle}
				onSeek={player.seekTo}
				onExpandedChange={handlePlayerExpandedChange}
				onPlaybackRateChange={player.setPlaybackRate}
				hidden={contentSearchOpen}
			/>

			{contentSearchOpen && searchSupported ? (
				<MobileBottomSearchBar
					value={contentSearchQuery}
					placeholder={t("detail.searchContentPlaceholder")}
					clearAriaLabel={t("detail.searchContentClear")}
					closeAriaLabel={t("detail.searchContentClose")}
					previousAriaLabel={t("detail.searchContentPrevious")}
					nextAriaLabel={t("detail.searchContentNext")}
					onValueChange={setContentSearchQuery}
					onClose={closeContentSearch}
					onPrevious={contentSearch.goToPrevious}
					onNext={contentSearch.goToNext}
					currentResult={contentSearch.currentIndex}
					totalResults={contentSearch.totalMatches}
					variant="recording-content"
					testIdPrefix="mobile-recording-share-content-search"
					className="bottom-[calc(12px+var(--share-watermark-safe-bottom,0px))] bg-[#f7f7f8]/95 backdrop-blur-sm"
					autoFocus
				/>
			) : null}

			<MobileRecordingShareExportSheet
				open={shareExportSheetOpen}
				recordingName={displayTitle}
				fileMap={fileMap}
				projectId={projectId}
				allowDownload={allowDownloadProjectFile}
				showCopyProject={showCopyProject}
				copyProjectLabel={copyProjectLabel}
				showLogin={showLogin}
				loginLabel={loginLabel}
				onCopyProject={onCopyProject}
				onLogin={onLogin}
				showShareSection={false}
				mainHeaderTitle={t("card.moreActions")}
				onOpenChange={setShareExportSheetOpen}
				onShareLink={() => undefined}
				onDownloadRecording={() => void handleDownloadRecording()}
				onSearch={searchSupported ? openContentSearch : undefined}
			/>
		</div>
	)
}

/** Aligns the readonly share header with the mobile detail prototype while keeping share actions disabled. */
function ShareMobileRecordingHeader({
	activeTab,
	onOpenMore,
	onTabChange,
}: {
	activeTab: MobileRecordingTopTab
	onOpenMore: () => void
	onTabChange: (tab: MobileRecordingTopTab) => void
}) {
	const { t } = useTranslation("audioRecordings")

	return (
		<header
			className="sticky top-0 z-20 bg-[#f7f7f8]"
			data-testid="mobile-recording-share-sticky-header"
		>
			<div className="relative flex min-h-[calc(52px+var(--safe-area-inset-top,0px))] items-center justify-between gap-2 px-4 pt-[var(--safe-area-inset-top,0px)]">
				{/* Keep the brand centered in a control-sized slot after removing the outer share header. */}
				<div className="inline-flex h-11 w-11 shrink-0 items-center justify-center">
					<Logo className="h-9 w-auto" />
				</div>
				{/* Center the segmented tabs independently from the trailing action so the layout stays balanced on narrow screens. */}
				<div className="pointer-events-none absolute inset-x-0 bottom-0 top-[var(--safe-area-inset-top,0px)] flex items-center justify-center px-20">
					<div className="pointer-events-auto grid grid-cols-2 rounded-full bg-muted p-[3px]">
						<TopTabButton
							active={activeTab === "source"}
							label={t("detail.tabs.source")}
							onClick={() => onTabChange("source")}
						/>
						<TopTabButton
							active={activeTab === "summary"}
							label={t("detail.tabs.summaryRoot")}
							onClick={() => onTabChange("summary")}
						/>
					</div>
				</div>

				<button
					type="button"
					className="inline-flex h-11 w-11 items-center justify-center text-foreground"
					onClick={onOpenMore}
					aria-label={t("card.moreActions")}
					data-testid="mobile-recording-share-more-button"
				>
					<MoreHorizontal className="size-5" strokeWidth={2} />
				</button>
			</div>
		</header>
	)
}

/** Reuses the compact top-level source/summary tab style while keeping the share page mutation-free. */
function TopTabButton({
	active,
	label,
	onClick,
}: {
	active: boolean
	label: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			className={
				active
					? "inline-flex h-9 items-center rounded-full bg-background px-5 text-sm font-medium text-foreground shadow-[0_4px_12px_rgba(0,0,0,0.10)]"
					: "inline-flex h-9 items-center rounded-full px-5 text-sm font-medium text-muted-foreground"
			}
			onClick={onClick}
		>
			{label}
		</button>
	)
}
