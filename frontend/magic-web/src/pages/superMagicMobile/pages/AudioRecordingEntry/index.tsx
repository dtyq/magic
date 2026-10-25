import { useEffect, useMemo, useRef, useState } from "react"
import { Settings } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"
import { useMemoizedFn } from "ahooks"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import { ProjectFilesStore } from "@/stores/projectFiles"
import AiChat from "@/components/business/RecordingSummary/components/AiChat"
import recordingSummaryStore from "@/stores/recordingSummary"
import { loadProjectAttachments } from "@/pages/superMagic/services/projectAttachmentsLoader"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import { useImageUrlResolver } from "@/pages/superMagic/components/Detail/contents/Md/hooks/useImageUrlResolver"
import { getRecordingImagesDirPath } from "@/services/recordSummary/const/files"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import {
	findRecordingImagesFolderId,
	getVisibleRecordingAttachmentTree,
} from "@/components/business/RecordingSummary/utils/recordingImageLookupSnapshot"

import {
	MobileShellSidebarToggleButton,
	SuperMobileShellRouteLayout,
	useOptionalSuperMobileShellOutlet,
} from "@/pages/superMagicMobile/components/MobileShell"
import AudioRecordingListPanel from "./AudioRecordingListPanel"
import { MobileRecordingSettingsSheet } from "./components/MobileRecordingSettingsSheet"
import { MobileRecordingSessionPage } from "./components/MobileRecordingSessionPage"
import { useMobileRecordingEntryFacade } from "./hooks/useMobileRecordingEntryFacade"

/**
 * Recordings quick-entry panel: mobile shell header + list panel wired to PC data layer.
 */
function AudioRecordingEntryPanel() {
	const { t } = useTranslation("super")
	const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
	const location = useLocation()
	const facade = useMobileRecordingEntryFacade()
	const recordSummaryService = initializeService()
	const [recordingProjectFilesStore] = useState(() => new ProjectFilesStore())
	const [recordingMentionStore] = useState(() =>
		createMentionPanelStore(recordingProjectFilesStore),
	)
	const [recordingImageAttachments, setRecordingImageAttachments] = useState<AttachmentFile[]>([])
	const [attachmentsReadyProjectId, setAttachmentsReadyProjectId] = useState("")
	const activeRecordingProjectId = recordingSummaryStore.businessData.project?.id
	const noteFile = recordSummaryService.getPresetFiles()?.note_file
	const noteFilePath = noteFile?.file_path ? `/${noteFile.file_path}` : ""
	const displayDirPath = useMemo(() => {
		if (!noteFile?.file_path) return undefined
		const lastSlashIndex = noteFile.file_path.lastIndexOf("/")
		return lastSlashIndex > 0 ? noteFile.file_path.substring(0, lastSlashIndex) : undefined
	}, [noteFile?.file_path])
	const folderPath = displayDirPath ? getRecordingImagesDirPath(displayDirPath) : "images"
	const { urlResolver } = useImageUrlResolver({
		attachments: recordingImageAttachments,
		relativeFilePath: noteFilePath,
		isReady:
			Boolean(activeRecordingProjectId && noteFilePath) &&
			attachmentsReadyProjectId === activeRecordingProjectId,
	})
	const imagesFolderIdRef = useRef<string | undefined>(undefined)

	/**
	 * Resolves the recording-scoped images directory before the shared project
	 * image extension uploads a captured photo.
	 */
	const resolveImagesFolderParentId = useMemoizedFn(async (targetFolderPath: string) => {
		if (!activeRecordingProjectId) return undefined
		if (imagesFolderIdRef.current) return imagesFolderIdRef.current

		const displayDirId = recordSummaryService.getAsrDisplayDir()?.directory_id
		if (!displayDirId) return undefined
		const folderName = targetFolderPath.split("/").filter(Boolean).pop() || "images"
		const existingFolderId = findRecordingImagesFolderId(
			recordingImageAttachments as unknown as AttachmentItem[],
			displayDirId,
			folderName,
		)
		if (existingFolderId) {
			imagesFolderIdRef.current = existingFolderId
			return existingFolderId
		}

		try {
			const result = await SuperMagicApi.createFile({
				project_id: activeRecordingProjectId,
				parent_id: displayDirId,
				file_name: folderName,
				is_directory: true,
			})
			const folderId = (result as { file_id?: string })?.file_id
			if (folderId) imagesFolderIdRef.current = folderId
			return folderId
		} catch (error) {
			if ((error as { code?: number })?.code === SuperMagicApiErrorCode.DuplicateFile) {
				const { tree } = await loadProjectAttachments({
					projectId: activeRecordingProjectId,
					includeHidden: true,
				})
				const existingFolderId = findRecordingImagesFolderId(
					tree as unknown as AttachmentItem[],
					displayDirId,
					folderName,
				)
				if (existingFolderId) imagesFolderIdRef.current = existingFolderId
				return existingFolderId
			}
			return undefined
		}
	})

	/**
	 * Refreshes the local attachment tree after a photo becomes a project file.
	 */
	const handleImageUploadSuccess = useMemoizedFn(async () => {
		const projectId = activeRecordingProjectId
		if (!projectId) return
		const { tree } = await loadProjectAttachments({
			projectId,
			includeHidden: true,
		})
		if (recordingSummaryStore.businessData.project?.id !== projectId) return
		setRecordingImageAttachments(tree as unknown as AttachmentFile[])
		recordingProjectFilesStore.setWorkspaceFileTree(getVisibleRecordingAttachmentTree(tree))
		setAttachmentsReadyProjectId(projectId)
	})
	useProjectAttachmentsChangeRealtime({
		projectId: activeRecordingProjectId,
		enabled: facade.presentation === "recording",
		store: recordingProjectFilesStore,
	})
	const lastHandledDeletedProjectIdRef = useRef<string>("")

	useEffect(() => {
		const deletedProjectId = (location.state as { deletedProjectId?: string } | null)
			?.deletedProjectId
		if (!deletedProjectId) return
		if (deletedProjectId === lastHandledDeletedProjectIdRef.current) return

		lastHandledDeletedProjectIdRef.current = deletedProjectId
		facade.clearOptimisticItem(deletedProjectId)
	}, [facade, location.state])

	useEffect(() => {
		if (facade.presentation !== "recording") return
		const projectId = activeRecordingProjectId
		if (!projectId) return
		imagesFolderIdRef.current = undefined
		const controller = new AbortController()
		setRecordingImageAttachments([])
		setAttachmentsReadyProjectId("")
		recordingMentionStore.initLoadAttachments(projectId)
		loadProjectAttachments({
			projectId,
			includeHidden: true,
			signal: controller.signal,
		})
			.then(({ tree }) => {
				if (!controller.signal.aborted) {
					setRecordingImageAttachments(tree as unknown as AttachmentFile[])
					recordingProjectFilesStore.setWorkspaceFileTree(
						getVisibleRecordingAttachmentTree(tree),
					)
					setAttachmentsReadyProjectId(projectId)
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					recordingMentionStore.finishLoadAttachmentsPromise(projectId)
				}
			})
		return () => controller.abort()
	}, [
		activeRecordingProjectId,
		facade.presentation,
		recordingMentionStore,
		recordingProjectFilesStore,
	])

	if (facade.presentation === "recording") {
		return (
			<MobileRecordingSessionPage
				title={facade.recordingTitle}
				duration={facade.duration}
				isPaused={facade.isPaused}
				isBusy={facade.isBusy}
				startupState={facade.startupState}
				startupErrorMessage={facade.startupErrorMessage}
				startupErrorDetail={facade.startupErrorDetail}
				transcriptMessages={facade.transcriptMessages}
				noteContent={facade.noteContent}
				transcriptionEnabled={facade.transcriptionEnabled}
				isEnablingTranscription={facade.isEnablingTranscription}
				onBack={facade.showList}
				onPause={() => void facade.pauseRecording()}
				onResume={() => void facade.resumeRecording()}
				onRetryStart={() => void facade.startRecording()}
				onFinish={() => void facade.finishRecording()}
				onCancel={() => void facade.cancelRecording()}
				onNoteChange={facade.updateNote}
				selectedProject={recordingSummaryStore.businessData.project}
				currentDocumentPath={noteFilePath}
				folderPath={folderPath}
				urlResolver={urlResolver}
				resolveImagesFolderParentId={resolveImagesFolderParentId}
				requireImagesFolderParentId
				onImageUploadSuccess={handleImageUploadSuccess}
				onEnableTranscription={() => void facade.enableTranscription()}
				onRenameTitle={facade.renameRecordingTitle}
				WaveformComponent={facade.WaveformComponent}
				MessageListComponent={facade.MessageListComponent}
				aiChat={
					<AiChat
						projectFilesStore={recordingProjectFilesStore}
						attachments={recordingProjectFilesStore.workspaceFileTree}
						attachmentList={recordingProjectFilesStore.workspaceFilesList}
						checkNowDebounced={() => undefined}
						recordSummaryFileStore={recordingMentionStore}
					/>
				}
			/>
		)
	}

	return (
		<div
			data-testid="mobile-audio-entry-page"
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-mobile-background"
		>
			<div className="mobile-page-header">
				<MobileShellSidebarToggleButton />
				<p className="mobile-page-header-title">{t("mobile.shell.navRecording")}</p>
				<button
					type="button"
					onClick={() => setSettingsSheetOpen(true)}
					className="mobile-page-header-btn ml-auto transition-transform active:scale-95"
					aria-label={t("mobile.recordingEntry.settings.settingsAria")}
					data-testid="mobile-recording-settings-trigger"
				>
					<Settings className="size-[22px] text-foreground" />
				</button>
			</div>

			<AudioRecordingListPanel
				isSessionActive={facade.isSessionActive}
				sessionTitle={facade.recordingTitle}
				sessionDuration={facade.duration}
				isSessionPaused={facade.isPaused}
				isSessionBusy={facade.isBusy}
				onResumeRecording={facade.showRecording}
				onStartRecording={() => void facade.startRecording()}
				onPauseRecording={() => void facade.pauseRecording()}
				onContinueRecording={() => void facade.resumeRecording()}
				onFinishRecording={() => void facade.finishRecording()}
				WaveformComponent={facade.WaveformComponent}
				optimisticItems={facade.optimisticItems}
				refreshToken={facade.refreshToken}
				onImportFiles={(files) => void facade.importAudioFiles(files)}
				isImporting={facade.isImporting}
				onResolveOptimisticItem={facade.clearOptimisticItem}
				onRetryUpload={facade.retryImport}
				AudioUploadActionComponent={facade.AudioUploadActionComponent}
				isOtherTabRecording={facade.isOtherTabRecording}
			/>
			<MobileRecordingSettingsSheet
				open={settingsSheetOpen}
				onOpenChange={setSettingsSheetOpen}
			/>
		</div>
	)
}

const ObservedAudioRecordingEntryPanel = observer(AudioRecordingEntryPanel)

/**
 * Page entry mounts the unified Super mobile shell when rendered outside the app route layout.
 */
export default function AudioRecordingEntryPage() {
	const shellOutlet = useOptionalSuperMobileShellOutlet()
	const { t } = useTranslation("super")

	if (shellOutlet) {
		return <ObservedAudioRecordingEntryPanel />
	}

	return (
		<SuperMobileShellRouteLayout
			activeView="recording"
			closeSidebarAriaLabel={t("mobile.shell.closeSidebar")}
			testIdPrefix="mobile-audio-recordings-page"
		>
			<ObservedAudioRecordingEntryPanel />
		</SuperMobileShellRouteLayout>
	)
}
