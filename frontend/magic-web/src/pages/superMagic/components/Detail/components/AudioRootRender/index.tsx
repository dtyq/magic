import { useCallback, useEffect, useMemo, useState } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { saveMediaSpeakersAndMagicProjectJs } from "../../contents/HTML/media/utils"
import HTML from "../../contents/HTML"
import { useRecordingAudioPlayer } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingAudioPlayer"
import { useRecordingColorSegments } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingColorSegments"
import { useShareRecordingDetailData } from "@/pages/superMagic/pages/AudioRecordings/hooks/useShareRecordingDetailData"
import { useRecordingDetailTranscriptPanelState } from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingDetailTranscriptPanelState"
import type { RecordingTranscriptSegment } from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail"
import {
	FOLDER_RECORDING_DETAIL_CAPABILITIES,
	SHARE_RECORDING_DETAIL_CAPABILITIES,
} from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail-capabilities"
import { collectSpeakerIdsFromText } from "@/pages/superMagic/pages/AudioRecordings/utils/markdownTimeLinks"
import { normalizeSpeakerSelection } from "@/pages/superMagic/pages/AudioRecordings/utils/speaker-filter"
import { hasRecordingDetailTabStrip } from "@/pages/superMagic/pages/AudioRecordings/utils/recording-detail-files"
import { playTranscriptFromSegment } from "@/pages/superMagic/pages/AudioRecordings/utils/transcript-playback"
import { RecordingDetailProvider } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailProvider"
import { RecordingDetailWorkbench } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailWorkbench"
import { RecordingDetailLeftColumn } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailLeftColumn"
import { RecordingDetailRightPanel } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailRightPanel"
import { RecordingDetailSpeakerDialog } from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailSpeakerDialog"
import { MobileAudioFolderContent } from "./MobileAudioFolderContent"
import { RecordingArtifactHeader } from "./RecordingArtifactHeader"
import type { RecordingArtifactContent } from "./useRecordingArtifactActions"
import useShareRoute from "@/pages/superMagic/hooks/useShareRoute"
import {
	RecordingDetailEmptyState,
	RecordingDetailPageSkeleton,
} from "@/pages/superMagic/pages/AudioRecordings/components/recording-detail/RecordingDetailEmptyState"

interface AudioRootRenderProps {
	data: AttachmentItem
	attachments?: AttachmentItem[]
	attachmentList?: AttachmentItem[]
	projectId?: string
	isFileShare?: boolean
	showFileHeader?: boolean
	allowDownload?: boolean
	allowEdit?: boolean
	onFullscreen?: () => void
	openFileTab?: (fileItem: AttachmentItem, autoEdit?: boolean) => void
	isFullscreen?: boolean
	[key: string]: unknown
}

/** Renders only the recording content workbench for an audio folder or its legacy HTML entry. */
export default function AudioRootRender(props: AudioRootRenderProps) {
	const {
		data,
		attachments = [],
		attachmentList = [],
		projectId = "",
		isFileShare,
		showFileHeader = true,
		allowDownload = true,
		allowEdit = true,
	} = props
	const shareRoute = useShareRoute()
	const isMobile = useIsMobile()
	const isReadonlyShare = Boolean(isFileShare || shareRoute.isShareRoute)
	const targetProjectId = projectId || data.project_id || data.file_id
	const detail = useShareRecordingDetailData({
		projectId: targetProjectId,
		resourceName: data.display_filename || data.file_name,
		target: data,
		attachments: { tree: attachments, list: attachmentList },
	})
	// Readonly shares may expose notes only when the attachment is part of the authorized snapshot.
	const showNotesTab = !isReadonlyShare || Boolean(detail.fileMap?.notes?.file_id)
	const capabilities = isReadonlyShare
		? SHARE_RECORDING_DETAIL_CAPABILITIES
		: {
				...FOLDER_RECORDING_DETAIL_CAPABILITIES,
				// Speaker metadata is a project file mutation and follows the project edit gate.
				canEditSpeakers: allowEdit,
			}
	const fallbackHtml = useMemo(
		() => resolveFallbackHtml(data, attachments, attachmentList),
		[data, attachments, attachmentList],
	)
	const recordingRoot = useMemo(
		() => resolveRecordingRoot(data, attachments, attachmentList),
		[data, attachments, attachmentList],
	)

	if (!isMobile && !detail.loading && detail.error && fallbackHtml) {
		// The generated HTML remains the compatibility path when the attachment bundle cannot load.
		return <HTML {...props} data={fallbackHtml as never} />
	}

	return (
		<RecordingDetailProvider capabilities={capabilities}>
			{isMobile ? (
				<MobileAudioFolderContent
					canEditSpeakers={capabilities.canEditSpeakers}
					detail={detail}
					showNotesTab={showNotesTab}
				/>
			) : (
				<AudioFolderWorkbench
					projectId={targetProjectId}
					canEditSpeakers={capabilities.canEditSpeakers}
					allowEdit={allowEdit}
					showFileHeader={showFileHeader}
					allowDownload={allowDownload}
					isReadonlyShare={isReadonlyShare}
					currentFile={recordingRoot}
					shareAttachments={attachments}
					onFullscreen={props.onFullscreen}
					openFileTab={props.openFileTab}
					isFullscreen={Boolean(props.isFullscreen)}
					detail={detail}
					showNotesTab={showNotesTab}
				/>
			)}
		</RecordingDetailProvider>
	)
}

interface AudioFolderWorkbenchProps {
	projectId: string
	canEditSpeakers: boolean
	allowEdit: boolean
	showFileHeader: boolean
	allowDownload: boolean
	isReadonlyShare: boolean
	currentFile: AttachmentItem
	shareAttachments: AttachmentItem[]
	onFullscreen?: () => void
	openFileTab?: (fileItem: AttachmentItem, autoEdit?: boolean) => void
	isFullscreen: boolean
	detail: ReturnType<typeof useShareRecordingDetailData>
	showNotesTab: boolean
}

/** Owns playback, speaker editing, and content navigation without mounting the recording page header or chat rail. */
function AudioFolderWorkbench({
	projectId,
	canEditSpeakers,
	allowEdit,
	showFileHeader,
	allowDownload,
	isReadonlyShare,
	currentFile,
	shareAttachments,
	onFullscreen,
	openFileTab,
	isFullscreen,
	detail,
	showNotesTab,
}: AudioFolderWorkbenchProps) {
	const {
		loading,
		refreshing,
		error,
		fileMap,
		texts,
		audioUrl,
		attachmentTree,
		attachmentList,
		refresh,
	} = detail
	const player = useRecordingAudioPlayer(audioUrl)
	const [playerExpanded, setPlayerExpanded] = useState(false)
	const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
	const [speakerSettingsOpen, setSpeakerSettingsOpen] = useState(false)
	const [speakerDraft, setSpeakerDraft] = useState<Record<string, string>>({})
	const [speakerNameOverrides, setSpeakerNameOverrides] = useState<Record<string, string>>({})
	const [selectedActiveKey, setSelectedActiveKey] = useState<string>()
	const summaryReady = Boolean(fileMap?.summaryFiles.length)
	// Folder previews collapse the transcript column only when the right panel still offers a tab-strip expand entry.
	const canCollapseTranscript = summaryReady && hasRecordingDetailTabStrip(fileMap, showNotesTab)
	const {
		isTranscriptPanelCollapsed,
		transcriptPanelWidth,
		workbenchGridRef,
		expandTranscriptPanel,
		collapseTranscriptPanel,
		setTranscriptPanelWidth,
	} = useRecordingDetailTranscriptPanelState()

	/** Routes a finished transcript drag to the matching persisted transition. */
	const handleTranscriptDragCommit = useCallback(
		(result: { collapsed: boolean; width: number }) => {
			if (result.collapsed) collapseTranscriptPanel()
			else setTranscriptPanelWidth(result.width)
		},
		[collapseTranscriptPanel, setTranscriptPanelWidth],
	)
	const summaryContent = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(texts.summary).map(([key, value]) => [key, value?.content]),
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
		[selectedSpeakerIds, speakerIds],
	)
	const colorSegments = useRecordingColorSegments(summaryReady, texts.summary.topics?.content)
	const activeKey =
		selectedActiveKey === "notes" && showNotesTab
			? "notes"
			: fileMap?.summaryFiles.some((file) => file.type === selectedActiveKey)
				? selectedActiveKey || "notes"
				: fileMap?.summaryFiles[0]?.type || "notes"
	const activeContent = useMemo<RecordingArtifactContent>(() => {
		if (activeKey === "notes") {
			return { content: texts.notes?.content, fileId: fileMap?.notes?.file_id }
		}
		const summary = texts.summary[activeKey as keyof typeof texts.summary]
		const summaryFile = fileMap?.summaryFiles.find((file) => file.type === activeKey)
		return { content: summary?.content, fileId: summaryFile?.file?.file_id }
	}, [activeKey, fileMap?.notes?.file_id, fileMap?.summaryFiles, texts])
	const activeFile = useMemo(() => {
		const summaryRef = fileMap?.summaryFiles.find((file) => file.type === activeKey)
		const mappedFile = activeKey === "notes" ? fileMap?.notes : summaryRef?.file
		if (mappedFile?.file_id) {
			return attachmentList.find((item) => item.file_id === mappedFile.file_id) ?? mappedFile
		}
		if (!summaryRef?.fileName) return undefined
		return attachmentList.find(
			(item) =>
				getAttachmentName(item) === summaryRef.fileName ||
				item.relative_file_path === summaryRef.fileName,
		)
	}, [activeKey, attachmentList, fileMap?.notes, fileMap?.summaryFiles])

	useEffect(() => {
		setSpeakerNameOverrides({})
		setSelectedActiveKey(undefined)
	}, [fileMap?.magicProject?.file_id])

	/** Opens the existing speaker editor with the latest persisted display names. */
	const openSpeakerSettings = useCallback(() => {
		if (!canEditSpeakers) return
		setSpeakerDraft(speakerNameMap)
		setSpeakerSettingsOpen(true)
	}, [canEditSpeakers, speakerNameMap])

	/** Persists speaker names to this bundle's magic.project.js without enabling other owner actions. */
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
		// Keep the embedded workbench mounted while persisted speaker metadata syncs in the background.
		void refresh({ silent: true })
	}, [canEditSpeakers, refresh, speakerDraft, speakerNameMap, texts.magicProject])

	/** Seeks summary time links in the shared inline audio player. */
	const handleSummaryTimeClick = useCallback(
		(seconds: number, end?: number) => {
			if (end != null) {
				player.playSegment({ start: seconds, end })
				return
			}
			player.seekTo(seconds, { autoplay: true })
		},
		[player],
	)

	/** Reuses the transcript playback behavior of the full recording detail page. */
	const handlePlaySegment = useCallback(
		(segment: RecordingTranscriptSegment) => {
			playTranscriptFromSegment(player, segment.start)
		},
		[player],
	)

	// A background attachment refresh must not replace already-rendered recording content with a skeleton.
	if (loading && !refreshing) return <RecordingDetailPageSkeleton />
	if (error) return <RecordingDetailEmptyState variant="pageError" className="flex-1" />

	return (
		<div
			className={cn(
				"flex h-full min-h-0 w-full flex-col overflow-hidden bg-background",
				// Headerless embeds keep the spacing that previously separated content from the preview edge.
				!showFileHeader && "pt-4",
			)}
		>
			{showFileHeader ? (
				<RecordingArtifactHeader
					projectId={projectId}
					recordingName={
						currentFile.display_filename || currentFile.file_name || "Recording"
					}
					fileMap={fileMap}
					activeContent={activeContent}
					activeFile={activeFile}
					currentFile={{
						id: currentFile.file_id || "",
						name: currentFile.display_filename || currentFile.file_name || "",
						type: "audio",
						projectId,
					}}
					attachments={shareAttachments}
					allowEdit={allowEdit}
					allowDownload={allowDownload}
					isReadonlyShare={isReadonlyShare}
					isFullscreen={isFullscreen}
					onFullscreen={onFullscreen}
					// Refresh the recording bundle in place; do not delegate to FilesViewer's
					// generic handler, which changes tab.refreshKey and remounts the preview.
					onRefresh={refresh}
					openFileTab={openFileTab}
				/>
			) : null}
			{/* Keep the action header mounted while refreshing; only the content area uses the existing skeleton. */}
			{refreshing ? (
				<RecordingDetailPageSkeleton />
			) : (
				<RecordingDetailWorkbench
					transcriptCollapsed={isTranscriptPanelCollapsed}
					transcriptWidth={transcriptPanelWidth}
					canCollapseTranscript={canCollapseTranscript}
					onTranscriptDragCommit={handleTranscriptDragCommit}
					gridRef={workbenchGridRef}
					compactHorizontalPadding
					left={
						<RecordingDetailLeftColumn
							searchScopeKey={projectId}
							audioRef={player.audioRef}
							audioUrl={audioUrl}
							transcriptMarkdown={texts.transcript?.content}
							currentSec={player.currentTime}
							currentTime={player.currentTime}
							duration={player.duration}
							playing={player.playing}
							expanded={playerExpanded}
							playbackRate={player.playbackRate}
							colorSegments={colorSegments}
							speakerNameMap={speakerNameMap}
							selectedSpeakerIds={effectiveSelectedSpeakerIds}
							onSelectedSpeakerIdsChange={setSelectedSpeakerIds}
							onToggle={player.toggle}
							onSeek={player.seekTo}
							onPlaySegment={handlePlaySegment}
							onExpandedChange={setPlayerExpanded}
							onPlaybackRateChange={player.setPlaybackRate}
							onOpenSpeakerSettings={openSpeakerSettings}
						/>
					}
					right={
						<RecordingDetailRightPanel
							fileMap={fileMap}
							summaryContent={summaryContent}
							notesContent={texts.notes?.content}
							attachmentTree={attachmentTree as unknown as AttachmentFile[]}
							notesFilePath={
								fileMap?.notes?.relative_file_path ?? fileMap?.notes?.path
							}
							attachmentList={attachmentList}
							summaryReady={summaryReady}
							summarizing={false}
							summaryFailed={false}
							showNotesTab={showNotesTab}
							speakerNameMap={speakerNameMap}
							onOpenSpeakerSettings={openSpeakerSettings}
							onTimeClick={handleSummaryTimeClick}
							activeKey={activeKey}
							onActiveKeyChange={setSelectedActiveKey}
							transcriptCollapsed={isTranscriptPanelCollapsed}
							onExpandTranscript={expandTranscriptPanel}
						/>
					}
				/>
			)}
			{canEditSpeakers ? (
				<RecordingDetailSpeakerDialog
					open={speakerSettingsOpen}
					speakerIds={speakerIds}
					value={speakerDraft}
					onValueChange={setSpeakerDraft}
					onOpenChange={setSpeakerSettingsOpen}
					onConfirm={() => void saveSpeakers()}
				/>
			) : null}
		</div>
	)
}

/** Finds the generated index.html inside the selected bundle for compatibility fallback. */
function resolveFallbackHtml(
	data: AttachmentItem,
	attachments: AttachmentItem[],
	attachmentList: AttachmentItem[],
): AttachmentItem | undefined {
	if (!data.is_directory && getAttachmentName(data).toLowerCase() === "index.html") return data

	const candidates = [...(data.children || []), ...attachments, ...attachmentList]
	return candidates.find((item) => {
		if (item.is_directory || getAttachmentName(item).toLowerCase() !== "index.html")
			return false
		return String(item.parent_id || "") === String(data.file_id || "")
	})
}

/** Returns the stable attachment display name used by bundle-entry matching. */
function getAttachmentName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.display_filename || item.name || ""
}

/** Resolves legacy index.html previews back to the recording folder used by share and locate actions. */
function resolveRecordingRoot(
	data: AttachmentItem,
	attachments: AttachmentItem[],
	attachmentList: AttachmentItem[],
): AttachmentItem {
	if (data.is_directory || !data.parent_id) return data
	const candidates = [...attachments, ...attachmentList]
	return candidates.find((item) => item.file_id === data.parent_id) ?? data
}
