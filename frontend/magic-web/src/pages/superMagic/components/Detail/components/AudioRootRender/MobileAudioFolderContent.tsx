import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { saveMediaSpeakersAndMagicProjectJs } from "../../contents/HTML/media/utils"
import { useRecordingAudioPlayer } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingAudioPlayer"
import { useRecordingColorSegments } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingColorSegments"
import { collectSpeakerIdsFromText } from "@/pages/superMagic/pages/AudioRecordings/utils/markdownTimeLinks"
import { normalizeSpeakerSelection } from "@/pages/superMagic/pages/AudioRecordings/utils/speaker-filter"
import { hasConfiguredRecordingFile } from "@/pages/superMagic/pages/AudioRecordings/utils/recording-detail-files"
import { RecordingDetailRegionEmptySlot } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailRegionEmptySlot"
import { RecordingDetailEmptyState } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailEmptyState"
import { MobileRecordingAudioPlayer } from "@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingAudioPlayer"
import { MobileRecordingSourcePanel } from "@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingSourcePanel"
import { MobileRecordingSummaryPanel } from "@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingSummaryPanel"
import { MobileRecordingSpeakerSheet } from "@/pages/superMagicMobile/pages/AudioRecordingDetail/components/MobileRecordingSpeakerSheet"
import type { MobileRecordingSourceTab } from "@/pages/superMagicMobile/pages/AudioRecordingDetail/types"
import type { useShareRecordingDetailData } from "@/pages/superMagic/pages/AudioRecordings/hooks/useShareRecordingDetailData"

type MobileContentTab =
	| "transcript"
	| "notes"
	| "summary"
	| "topics"
	| "highlights"
	| "insights"
	| "metrics"
	| "mindmap"

const CONTENT_TABS: MobileContentTab[] = [
	"transcript",
	"notes",
	"summary",
	"topics",
	"highlights",
	"insights",
	"metrics",
	"mindmap",
]

interface MobileAudioFolderContentProps {
	canEditSpeakers: boolean
	detail: ReturnType<typeof useShareRecordingDetailData>
	showNotesTab: boolean
}

/** Renders the recording bundle as a single-level mobile content preview embedded in the file tree. */
export function MobileAudioFolderContent({
	canEditSpeakers,
	detail,
	showNotesTab,
}: MobileAudioFolderContentProps) {
	const { t } = useTranslation("audioRecordings")
	const { fileMap, texts, audioUrl, attachmentTree, attachmentList, refresh } = detail
	const player = useRecordingAudioPlayer(audioUrl)
	const [activeTab, setActiveTab] = useState<MobileContentTab>("transcript")
	const [playerExpanded, setPlayerExpanded] = useState(false)
	const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
	const [speakerSettingsOpen, setSpeakerSettingsOpen] = useState(false)
	const [speakerDraft, setSpeakerDraft] = useState<Record<string, string>>({})
	const [speakerNameOverrides, setSpeakerNameOverrides] = useState<Record<string, string>>({})

	const summaryFiles = fileMap?.summaryFiles ?? []
	const hasNotesTab = showNotesTab && hasConfiguredRecordingFile(fileMap, "notes")
	// Keep the current view valid when a realtime config refresh removes notes.
	const resolvedActiveTab = activeTab === "notes" && !hasNotesTab ? "transcript" : activeTab
	const contentTabs = hasNotesTab ? CONTENT_TABS : CONTENT_TABS.filter((tab) => tab !== "notes")
	const summaryContent = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(texts.summary ?? {}).map(([key, value]) => [key, value?.content]),
			),
		[texts.summary],
	)
	const speakerNameMap = useMemo(
		() => ({
			...(fileMap?.magicProjectConfig?.metadata?.speakers ?? {}),
			...speakerNameOverrides,
		}),
		[fileMap?.magicProjectConfig?.metadata?.speakers, speakerNameOverrides],
	)
	const speakerIds = useMemo(
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
		() => normalizeSpeakerSelection(speakerIds, selectedSpeakerIds),
		[speakerIds, selectedSpeakerIds],
	)
	const colorSegments = useRecordingColorSegments(
		Boolean(summaryFiles.length),
		texts.summary?.topics?.content,
	)
	const selectedSummaryType =
		resolvedActiveTab === "summary" ||
		resolvedActiveTab === "topics" ||
		resolvedActiveTab === "highlights" ||
		resolvedActiveTab === "insights" ||
		resolvedActiveTab === "metrics" ||
		resolvedActiveTab === "mindmap"
			? resolvedActiveTab === "summary"
				? "summary"
				: resolvedActiveTab
			: ""

	useEffect(() => {
		setSpeakerNameOverrides({})
	}, [fileMap?.magicProject?.file_id])

	/** Opens editing only for ordinary project previews; share capabilities keep this callback inert. */
	const openSpeakerSettings = useCallback(() => {
		if (!canEditSpeakers) return
		setSpeakerDraft(speakerNameMap)
		setSpeakerSettingsOpen(true)
	}, [canEditSpeakers, speakerNameMap])

	/** Persists the edited speaker map and refreshes the shared attachment snapshot. */
	const saveSpeakers = useCallback(async () => {
		if (!canEditSpeakers || !texts.magicProject?.fileId || !texts.magicProject.content) return
		const nextSpeakers = { ...speakerNameMap, ...speakerDraft }
		await saveMediaSpeakersAndMagicProjectJs({
			mediaSpeakers: nextSpeakers,
			magicProjectJsFileInfo: {
				fileId: texts.magicProject.fileId,
				content: texts.magicProject.content,
			},
		})
		setSpeakerNameOverrides(nextSpeakers)
		setSpeakerSettingsOpen(false)
		void refresh()
	}, [canEditSpeakers, refresh, speakerDraft, speakerNameMap, texts.magicProject])

	/** Seeks summary time links while preserving optional range playback. */
	const handleTimeClick = useCallback(
		(seconds: number, end?: number) => {
			if (end != null) player.playSegment({ start: seconds, end })
			else player.seekTo(seconds, { autoplay: true })
		},
		[player],
	)

	const labels: Record<MobileContentTab, string> = {
		transcript: t("detail.tabs.transcript"),
		notes: t("detail.tabs.notes"),
		summary: t("detail.tabs.summary"),
		topics: t("detail.tabs.topics"),
		highlights: t("detail.tabs.highlights"),
		insights: t("detail.tabs.insights"),
		metrics: t("detail.tabs.metrics"),
		mindmap: t("detail.tabs.mindmap"),
	}
	const summaryFile = selectedSummaryType
		? summaryFiles.find((file) => file.type === selectedSummaryType)
		: undefined

	if (detail.loading && !detail.refreshing) {
		// Keep the embedded preview aligned with the mobile sheet instead of mounting the desktop two-column skeleton.
		return (
			<div
				className="flex h-full items-center justify-center text-sm text-muted-foreground"
				role="status"
			>
				<Loader2 className="mr-2 size-4 animate-spin" />
				{t("detail.loading")}
			</div>
		)
	}
	if (detail.error) return <RecordingDetailEmptyState variant="pageError" className="flex-1" />

	return (
		<div
			className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-mobile-background"
			data-testid="mobile-audio-folder-content"
		>
			<div className="shrink-0 overflow-x-auto border-b border-border/50 bg-mobile-background px-3 py-2">
				<div className="flex w-max gap-1">
					{contentTabs.map((tab) => (
						<button
							key={tab}
							type="button"
							className={cn(
								"h-8 shrink-0 rounded-full px-4 text-sm font-medium",
								resolvedActiveTab === tab
									? "bg-foreground text-background"
									: "text-muted-foreground",
							)}
							onClick={() => setActiveTab(tab)}
							data-testid={`mobile-audio-folder-tab-${tab}`}
						>
							{labels[tab]}
						</button>
					))}
				</div>
			</div>
			<div className="relative flex min-h-0 flex-1 flex-col">
				{resolvedActiveTab === "transcript" || resolvedActiveTab === "notes" ? (
					<MobileRecordingSourcePanel
						transcriptContent={texts.transcript?.content}
						notesContent={texts.notes?.content}
						playing={player.playing}
						currentTime={player.currentTime}
						scrollPaddingBottom="calc(env(safe-area-inset-bottom) + 112px)"
						availableSpeakerIds={speakerIds}
						selectedSpeakerIds={effectiveSelectedSpeakerIds}
						speakerNameMap={speakerNameMap}
						onSelectedSpeakerIdsChange={setSelectedSpeakerIds}
						onOpenSpeakerSettings={openSpeakerSettings}
						onSeek={(seconds) => player.seekTo(seconds, { autoplay: true })}
						onActiveTabChange={() => undefined}
						showTabBar={false}
						activeTab={resolvedActiveTab as MobileRecordingSourceTab}
						attachmentTree={attachmentTree as unknown as AttachmentFile[]}
						notesFilePath={fileMap?.notes?.relative_file_path ?? fileMap?.notes?.path}
					/>
				) : summaryFile ? (
					<MobileRecordingSummaryPanel
						summaryFiles={[summaryFile]}
						summaryContent={summaryContent}
						attachmentList={attachmentList}
						scrollPaddingBottom="calc(env(safe-area-inset-bottom) + 112px)"
						speakerNameMap={speakerNameMap}
						onOpenSpeakerSettings={openSpeakerSettings}
						onTimeClick={handleTimeClick}
						showTypeTabs={false}
						activeType={selectedSummaryType}
					/>
				) : (
					<RecordingDetailRegionEmptySlot>
						<p className="text-center text-sm text-muted-foreground">
							{t("detail.emptySummary")}
						</p>
					</RecordingDetailRegionEmptySlot>
				)}
			</div>
			<MobileRecordingAudioPlayer
				audioRef={player.audioRef}
				audioUrl={audioUrl}
				currentSec={player.currentTime}
				duration={player.duration}
				playing={player.playing}
				expanded={playerExpanded}
				onToggle={player.toggle}
				onSeek={(seconds) => player.seekTo(seconds, { autoplay: false })}
				onExpandedChange={setPlayerExpanded}
				playbackRate={player.playbackRate}
				onPlaybackRateChange={player.setPlaybackRate}
				colorSegments={colorSegments}
			/>
			{canEditSpeakers ? (
				<MobileRecordingSpeakerSheet
					isOpen={speakerSettingsOpen}
					speakerIds={speakerIds}
					value={speakerDraft}
					onValueChange={setSpeakerDraft}
					onCancel={() => setSpeakerSettingsOpen(false)}
					onConfirm={() => void saveSpeakers()}
				/>
			) : null}
		</div>
	)
}
