import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { useCallback, useMemo, useState } from "react"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { useRecordingAudioPlayer } from "../../hooks/useRecordingAudioPlayer"
import { useRecordingColorSegments } from "../../hooks/useRecordingColorSegments"
import { useShareRecordingDetailData } from "../../hooks/useShareRecordingDetailData"
import { useRecordingDetailTranscriptPanelState } from "../../hooks/useRecordingDetailTranscriptPanelState"
import type { RecordingTranscriptSegment } from "../../types/recording-detail"
import { buildShareRecordingCapabilities } from "../../utils/share-recording-detail"
import { collectExportableFileIds } from "../../utils/download-recording-batch"
import { downloadRecordingAudioFile } from "../../utils/download-recording-audio"
import { downloadRecordingAttachmentFile } from "../../utils/download-recording-attachment"
import { collectSpeakerIdsFromText } from "../../utils/markdownTimeLinks"
import { normalizeSpeakerSelection } from "../../utils/speaker-filter"
import {
	getAttachmentFileName,
	hasRecordingDetailTabStrip,
} from "../../utils/recording-detail-files"
import { playTranscriptFromSegment } from "../../utils/transcript-playback"
import { RecordingDetailProvider } from "./RecordingDetailProvider"
import { RecordingDetailHeader } from "./RecordingDetailHeader"
import { RecordingDetailWorkbench } from "./RecordingDetailWorkbench"
import { RecordingDetailLeftColumn } from "./RecordingDetailLeftColumn"
import { RecordingDetailRightPanel } from "./RecordingDetailRightPanel"
import { RecordingDetailEmptyState, RecordingDetailPageSkeleton } from "./RecordingDetailEmptyState"
import { AUDIO_RECORDINGS_SHARE_PAGE_SHELL_CLASS } from "../../constants/page-shell"

interface RecordingDetailShareDesktopProps {
	projectId: string
	resourceName?: string
	allowDownloadProjectFile: boolean
	attachments: {
		tree: AttachmentItem[]
		list: AttachmentItem[]
	}
}

/** Renders the desktop read-only recording detail workbench from share attachments instead of owner project APIs. */
export function RecordingDetailShareDesktop({
	projectId,
	resourceName,
	allowDownloadProjectFile,
	attachments,
}: RecordingDetailShareDesktopProps) {
	const { permissions: access } = useFileAccess()
	const fileApi = useFileApi()
	const {
		loading,
		error,
		projectItem,
		fileMap,
		texts,
		audioUrl,
		title,
		attachmentTree,
		attachmentList,
	} = useShareRecordingDetailData({
		projectId,
		resourceName,
		attachments,
	})
	const capabilities = useMemo(
		() => buildShareRecordingCapabilities(allowDownloadProjectFile),
		[allowDownloadProjectFile],
	)
	const player = useRecordingAudioPlayer(audioUrl)
	const [playerExpanded, setPlayerExpanded] = useState(false)
	const summaryReady = Boolean(fileMap?.summaryFiles.length)
	// Share views only render a tab strip when summary/notes content is present, so collapse follows that.
	const canCollapseTranscript =
		summaryReady && hasRecordingDetailTabStrip(fileMap, Boolean(fileMap?.notes?.file_id))
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
	const [selectedSpeakerIds, setSelectedSpeakerIds] = useState<string[]>([])
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
	const colorSegments = useRecordingColorSegments(summaryReady, texts.summary.topics?.content)

	/** Sends summary time chips to the shared audio bar without enabling any owner mutations. */
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

	/** Reuses transcript segment playback from the owner page while keeping the share shell read-only. */
	const handlePlaySegment = useCallback(
		(segment: RecordingTranscriptSegment) => {
			// Share detail should mirror the owner detail transcript behavior and continue playback after the jump.
			playTranscriptFromSegment(player, segment.start)
		},
		[player],
	)

	/** Downloads the original audio file when the share permission allows export. */
	const handleDownloadAudio = useCallback(async () => {
		if (!access.download) return
		await downloadRecordingAudioFile({
			fileId: fileMap?.audio?.file_id,
			audioFile: fileMap?.audio,
			fallbackName: `${title || "recording"}_audio`,
			fileApi,
		})
	}, [access.download, fileApi, fileMap?.audio, title])

	/** Downloads the transcript markdown directly from the shared attachment file id. */
	const handleDownloadTranscript = useCallback(async () => {
		if (!access.download) return
		if (!fileMap?.transcript?.file_id) return
		await downloadRecordingAttachmentFile({
			fileId: fileMap.transcript.file_id,
			fileName:
				getAttachmentFileName(fileMap.transcript) ||
				`${title || "recording"}_transcript.md`,
			fileApi,
		})
	}, [access.download, fileApi, fileMap?.transcript, title])

	/** Downloads the notes markdown directly from the shared attachment file id. */
	const handleDownloadNotes = useCallback(async () => {
		if (!access.download) return
		if (!fileMap?.notes?.file_id) return
		await downloadRecordingAttachmentFile({
			fileId: fileMap.notes.file_id,
			fileName: getAttachmentFileName(fileMap.notes) || `${title || "recording"}_notes.md`,
			fileApi,
		})
	}, [access.download, fileApi, fileMap?.notes, title])

	/** Downloads one summary artifact at a time because share detail never exposes owner batch operations. */
	const handleDownloadSummaryType = useCallback(
		async (type: string) => {
			if (!access.download) return
			const fileRef = fileMap?.summaryFiles.find((item) => item.type === type)
			if (!fileRef?.file?.file_id) return
			await downloadRecordingAttachmentFile({
				fileId: fileRef.file.file_id,
				fileName:
					getAttachmentFileName(fileRef.file) || `${title || "recording"}_${type}.md`,
				fileApi,
			})
		},
		[access.download, fileApi, fileMap?.summaryFiles, title],
	)

	const exportAvailability = useMemo(
		() => ({
			hasAudio: Boolean(fileMap?.audio?.file_id),
			hasTranscript: Boolean(fileMap?.transcript?.file_id),
			hasNotes: Boolean(fileMap?.notes?.file_id),
			hasSummaryFiles: Boolean(fileMap?.summaryFiles.length),
			hasAnyExportable: collectExportableFileIds(fileMap).length > 0,
		}),
		[fileMap],
	)

	return (
		<RecordingDetailProvider capabilities={capabilities}>
			<div
				// The share route already provides the outer frame, so this shell only restores the
				// white recording-detail background and avoids adding a second rounded border card.
				className={AUDIO_RECORDINGS_SHARE_PAGE_SHELL_CLASS}
				data-testid="recording-detail-share-desktop"
			>
				<RecordingDetailHeader
					title={title || resourceName || "Recording"}
					projectItem={projectItem}
					fileMap={fileMap}
					exportAvailability={exportAvailability}
					canGenerateSummary={false}
					summarySubmitting={false}
					showBackButton={false}
					onBack={() => undefined}
					onRename={async () => false}
					onGenerateSummary={() => undefined}
					onExportAudio={() => void handleDownloadAudio()}
					onExportTranscript={() => void handleDownloadTranscript()}
					onExportNotes={() => void handleDownloadNotes()}
					onExportSummaryType={(type) => void handleDownloadSummaryType(type)}
					onExportAll={() => undefined}
					onCreateShare={() => undefined}
					onManageShare={() => undefined}
					onMoveGroup={() => undefined}
					onDelete={() => undefined}
				/>

				{loading ? <RecordingDetailPageSkeleton /> : null}

				{!loading && error ? (
					<RecordingDetailEmptyState
						variant="pageError"
						className="flex-1"
						onAction={() => undefined}
					/>
				) : null}

				{!loading && !error ? (
					<RecordingDetailWorkbench
						transcriptCollapsed={isTranscriptPanelCollapsed}
						transcriptWidth={transcriptPanelWidth}
						canCollapseTranscript={canCollapseTranscript}
						onTranscriptDragCommit={handleTranscriptDragCommit}
						gridRef={workbenchGridRef}
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
								showSpeakerFilter
								onToggle={player.toggle}
								onSeek={player.seekTo}
								onPlaySegment={handlePlaySegment}
								onExpandedChange={setPlayerExpanded}
								onPlaybackRateChange={player.setPlaybackRate}
								onOpenSpeakerSettings={() => undefined}
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
								showNotesTab={Boolean(fileMap?.notes?.file_id)}
								speakerNameMap={speakerNameMap}
								onOpenSpeakerSettings={() => undefined}
								onTimeClick={handleSummaryTimeClick}
								transcriptCollapsed={isTranscriptPanelCollapsed}
								onExpandTranscript={expandTranscriptPanel}
							/>
						}
					/>
				) : null}
			</div>
		</RecordingDetailProvider>
	)
}
