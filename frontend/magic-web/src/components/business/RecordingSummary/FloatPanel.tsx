import { observer } from "mobx-react-lite"
import { useEffect, useCallback, useMemo, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import { reaction } from "mobx"
import { matchPath, useLocation } from "react-router"
import recordingSummaryStore from "@/stores/recordingSummary"
import { initializeService } from "@/services/recordSummary/serviceInstance"
import { getRecordingImagesDirPath } from "@/services/recordSummary/const/files"
import useCancelRecord from "@/components/business/RecordingSummary/hooks/useCancelRecord"
import PcFloatPanel from "./components/PcFloatPanel"
import { useIsMobile } from "@/hooks/useIsMobile"
import MobileFloatPanel from "./components/MobileFloatPanel"
import { onSummarizeSuccessDefaultCallback } from "./utils/callback"
import { useMemoizedFn, useDebounceFn, useUpdateEffect } from "ahooks"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useImageUrlResolver } from "@/pages/superMagic/components/Detail/contents/Md/hooks/useImageUrlResolver"
import type { AttachmentFile } from "@/pages/superMagic/utils/image-url-resolver"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useFileChangeCheck } from "./hooks/useFileChangeCheck"
import type { SimpleEditorRef } from "@/components/tiptap-templates/simple/types"
import { SuperMagicApi } from "@/apis"
import { SuperMagicApiErrorCode } from "@/pages/superMagic/constants/apiErrorCodes"
import useSandboxPreWarm from "@/pages/superMagic/components/MessagePanel/hooks/useSandboxPreWarm"
import { loadProjectAttachments } from "@/pages/superMagic/services"
import { runActiveEditor } from "@/utils/tiptapEditorLifecycle"
import { RoutePath } from "@/constants/routes"
import { RouteName } from "@/routes/constants"
import useNavigate from "@/routes/hooks/useNavigate"
import { shouldHideRecordingFloatPanel } from "./utils/float-panel-visibility-policy"
import {
	getVisibleRecordingAttachmentTree,
	findRecordingImagesFolderId,
	selectRecordingImageLookupTree,
	shouldMarkRecordingAttachmentsReady,
} from "./utils/recordingImageLookupSnapshot"
import { isAudioProjectMode } from "@/services/audioRecordings"
import { MobileActiveRecordingIndicator } from "@/pages/superMagicMobile/pages/AudioRecordingEntry/components/MobileActiveRecordingIndicator"
import {
	getRecordingTopicModel,
	saveRecordingTopicModel,
} from "@/pages/superMagic/pages/AudioRecordings/apis/recording-settings-api"
import {
	resolveAutoSummaryEnabled,
	settingsToApiPayload,
} from "@/pages/superMagic/pages/AudioRecordings/utils/recording-settings-mapper"
import {
	getCachedRecordingSettings,
	patchCachedRecordingSettings,
} from "@/pages/superMagic/pages/AudioRecordings/hooks/useRecordingSettings"
import magicToast from "@/components/base/MagicToaster/utils"

/**
 * 录音纪要浮动面板
 */
export interface RecordingSummaryFloatPanelProps {}

export function RecordingSummaryFloatPanel() {
	const { t } = useTranslation(["super", "recordSummary"])
	const isMobile = useIsMobile()
	const location = useLocation()
	const navigate = useNavigate()
	const recordSummaryService = initializeService()
	const isOnMobileRecordingsListRoute =
		isMobile &&
		matchPath(`/:clusterCode${RoutePath.AudioRecordings}`, location.pathname) != null
	const isOnMobileRecordingDetailRoute =
		isMobile &&
		matchPath(`/:clusterCode${RoutePath.AudioRecordingDetail}`, location.pathname) != null
	const isManagedByMobileRecordingPage =
		isOnMobileRecordingsListRoute || isOnMobileRecordingDetailRoute

	const editorRef = useRef<SimpleEditorRef>(null)
	// Local store for overlay file UI and @ mentions. Note image restore uses a
	// separate hidden-inclusive snapshot so the visible-only store contract stays intact.
	const { projectFilesStore, recordSummaryFileStore } = useMemo(() => {
		const projectFilesStore = new ProjectFilesStore()
		const recordSummaryFileStore = createMentionPanelStore(projectFilesStore)
		return { projectFilesStore, recordSummaryFileStore }
	}, [])

	// Attachment state management
	const [attachments, _setAttachments] = useState<any[]>([])
	const [attachmentList, _setAttachmentList] = useState<any[]>([])
	/** Hidden-inclusive tree used only for note image path lookup. */
	const [imageLookupAttachments, setImageLookupAttachments] = useState<AttachmentItem[]>([])
	const [isTranscriptionToggling, setIsTranscriptionToggling] = useState(false)
	/** Project id whose attachments fetch has settled; gates note image URL resolution after refresh. */
	const [attachmentsReadyProjectId, setAttachmentsReadyProjectId] = useState("")
	/** Cache the folder id together with its scope so project switches cannot reuse it. */
	const imagesFolderRef = useRef<
		{ projectId: string; parentId: string; folderName: string; folderId: string } | undefined
	>(undefined)
	const attachmentsRefreshRef = useRef<{
		requestId: number
		controller: AbortController | null
	}>({ requestId: 0, controller: null })

	/**
	 * Marks attachment context ready for the active project after a settled load.
	 */
	const markAttachmentsReady = useMemoizedFn((projectId: string | undefined) => {
		if (!projectId) return
		setAttachmentsReadyProjectId(projectId)
	})

	// Sync attachments with projectFilesStore
	const setAttachments = useMemoizedFn((newAttachments: any[]) => {
		_setAttachments(newAttachments)
		projectFilesStore.setWorkspaceFileTree(newAttachments)
		_setAttachmentList(projectFilesStore.workspaceFilesList)
	})

	// Prepare common data for file change check
	const currentNoteContent = recordingSummaryStore.note.content

	/**
	 * 移动端在录音纪要面板未展开时，收起 AI 聊天面板
	 */
	useUpdateEffect(() => {
		if (isMobile && !recordingSummaryStore.isExpanded) {
			recordingSummaryStore.floatPanel.toggleExpandedAiChat()
		}
	}, [isMobile])

	// File change check hook
	const { handleAttachmentsChange, checkNoteFileChange } = useFileChangeCheck({
		currentContent: currentNoteContent,
		onAttachmentsChange: ({ tree }) => {
			setAttachments(tree)
			markAttachmentsReady(recordingSummaryStore.businessData.project?.id)
		},
		onMergedResult: (mergedContent) => {
			runActiveEditor(editorRef?.current?.editor, (editor) => {
				editor.commands.setContent(mergedContent)
				editor.commands.focus()
			})
			recordSummaryService.updateNote(mergedContent)
		},
	})

	const resetAttachments = useMemoizedFn(() => {
		setAttachments([])
		setImageLookupAttachments([])
		setAttachmentsReadyProjectId("")
		projectFilesStore.setWorkspaceFileTree([])
	})

	useEffect(() => {
		const refreshState = attachmentsRefreshRef.current
		return () => {
			refreshState.controller?.abort()
		}
	}, [])

	/** Reloads the hidden-inclusive snapshot used by note image URL resolution. */
	const refreshRecordingAttachments = useMemoizedFn(async (projectId?: string) => {
		const requestId = attachmentsRefreshRef.current.requestId + 1
		attachmentsRefreshRef.current.requestId = requestId
		attachmentsRefreshRef.current.controller?.abort()

		if (!projectId) {
			attachmentsRefreshRef.current.controller = null
			resetAttachments()
			pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
			return { tree: [], list: [] }
		}

		const controller = new AbortController()
		attachmentsRefreshRef.current.controller = controller
		pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
		try {
			const res = await loadProjectAttachments({
				projectId,
				signal: controller.signal,
				includeHidden: true,
			})
			if (
				requestId !== attachmentsRefreshRef.current.requestId ||
				controller.signal.aborted
			) {
				return { tree: [], list: [] }
			}
			const lookupTree = res.tree as AttachmentItem[]
			setImageLookupAttachments(lookupTree)
			// Store/UI keep the visible-only tree; image lookup uses the full snapshot.
			setAttachments(getVisibleRecordingAttachmentTree(lookupTree))
			recordSummaryFileStore.finishLoadAttachmentsPromise(projectId)
			markAttachmentsReady(projectId)
			return res
		} catch (error: unknown) {
			if (controller.signal.aborted) return { tree: [], list: [] }
			console.error("Failed to fetch attachments:", error)
			resetAttachments()
			// Settle readiness even on failure so images do not spin forever.
			markAttachmentsReady(projectId)
			return { tree: [], list: [] }
		} finally {
			if (requestId === attachmentsRefreshRef.current.requestId) {
				attachmentsRefreshRef.current.controller = null
				pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
			}
		}
	})

	// Update attachments from API with a debounce for project-selection changes.
	const { run: updateAttachments } = useDebounceFn(
		(
			selectedProject: any,
			callback?: (res: { tree: AttachmentItem[]; list: AttachmentItem[] }) => void,
		) => {
			void refreshRecordingAttachments(selectedProject?.id).then(callback)
		},
		{ wait: 500 },
	)

	// 监听窗口大小变化，自动调整位置
	useEffect(() => {
		function handleResize() {
			// 移动端和PC端都使用防抖调整，但标记为 resize 触发
			recordingSummaryStore.floatPanel.schedulePositionAdjustment(200, true)
		}

		// 移动端额外监听方向变化
		function handleOrientationChange() {
			// 延迟更长时间，等待方向变化完成
			recordingSummaryStore.floatPanel.schedulePositionAdjustment(400, true)
		}

		window.addEventListener("resize", handleResize)

		// 移动端虚拟键盘处理（通过 Visual Viewport API）
		const handleVisualViewportChange = () => {
			// 虚拟键盘弹出/收起时调整位置
			recordingSummaryStore.floatPanel.schedulePositionAdjustment(150, true)
		}

		// 移动端特殊事件监听
		if (isMobile) {
			// 方向变化监听
			window.addEventListener("orientationchange", handleOrientationChange)
			if (screen.orientation) {
				screen.orientation.addEventListener("change", handleOrientationChange)
			}

			// 虚拟键盘监听
			if (window.visualViewport) {
				window.visualViewport.addEventListener("resize", handleVisualViewportChange)
			}
		}

		return () => {
			window.removeEventListener("resize", handleResize)
			if (isMobile) {
				window.removeEventListener("orientationchange", handleOrientationChange)
				if (screen.orientation) {
					screen.orientation.removeEventListener("change", handleOrientationChange)
				}
				if (window.visualViewport) {
					window.visualViewport.removeEventListener("resize", handleVisualViewportChange)
				}
			}
			// 组件卸载时清理定时器
			recordingSummaryStore.floatPanel.cleanup()
		}
	}, [isMobile])

	// 组件卸载时的统一清理机制
	useEffect(() => {
		return () => {
			// 清理 FloatPanelStore 中的定时器
			recordingSummaryStore.floatPanel.cleanup()
		}
	}, [])

	// 当可见性或展开状态变化时，调度一次位置校正，避免依赖调整中的中间状态导致循环
	useEffect(() => {
		const dispose = reaction(
			() => [recordingSummaryStore.isVisible, recordingSummaryStore.isExpanded],
			([isVisible]) => {
				if (!isVisible) return
				recordingSummaryStore.floatPanel.schedulePositionAdjustment(350)
			},
		)

		return () => dispose()
	}, [])

	const handleCompleteRecordingWithSummary = useCallback(() => {
		recordSummaryService.completeRecordingWithSummary({
			onSuccess: (res) => {
				console.log(res)
				// onWorkspaceStateChange({
				// 	workspaceId: res.workspace_id,
				// 	projectId: res.project_id,
				// 	topicId: res.topic_id,
				// })
				onSummarizeSuccessDefaultCallback(res)
			},
			onError: (error) => {
				console.log(error)
			},
		})
	}, [])

	const { cancelRecordFromUI: cancelRecord } = useCancelRecord({
		onSummarizeSuccess: (res) => {
			// onWorkspaceStateChange({
			// 	workspaceId: res.workspace_id,
			// 	projectId: res.project_id,
			// 	topicId: res.topic_id,
			// })

			onSummarizeSuccessDefaultCallback(res)
		},
	})

	useEffect(() => {
		recordingSummaryStore.floatPanel.setIsMobile(isMobile)
	}, [isMobile])

	// Prepare common data for both mobile and PC
	const message = recordingSummaryStore.message
	const duration = recordingSummaryStore.duration
	const editor = {
		value: recordingSummaryStore.note.content,
		onChange: recordSummaryService.updateNote,
	}
	const selectedProjectId = recordingSummaryStore.businessData.project?.id
	const selectedWorkspaceId = recordingSummaryStore.businessData.workspace?.id
	const selectProjectDisabled = recordingSummaryStore.selectProjectDisabled

	// Initialize attachments polling
	const { checkNowDebounced } = useAttachmentsPolling({
		projectId: selectedProjectId,
		autoStart: false,
		onAttachmentsChange: handleAttachmentsChange,
	})

	useProjectAttachmentsChangeRealtime({
		projectId: selectedProjectId,
		enabled: !isManagedByMobileRecordingPage,
		store: projectFilesStore,
		onAttachmentsChange: useMemoizedFn(({ tree, list, source }) => {
			_setAttachments(tree)
			_setAttachmentList(list)
			setImageLookupAttachments((current) =>
				selectRecordingImageLookupTree({
					current,
					incoming: tree,
					source,
				}),
			)
			if (
				shouldMarkRecordingAttachmentsReady({
					treeLength: tree.length,
					source,
				})
			) {
				markAttachmentsReady(selectedProjectId)
			}
			void checkNoteFileChange(list)
		}),
		onFallbackError: useMemoizedFn((error: unknown) => {
			console.error("Failed to refresh realtime recording summary attachments:", error)
		}),
	})

	// Initialize attachments when project changes
	useEffect(() => {
		if (isManagedByMobileRecordingPage) return
		const selectedProject = recordingSummaryStore.businessData.project
		attachmentsRefreshRef.current.requestId += 1
		attachmentsRefreshRef.current.controller?.abort()
		attachmentsRefreshRef.current.controller = null
		// Reset readiness when switching projects after restore/remount.
		setAttachmentsReadyProjectId("")
		setImageLookupAttachments([])
		imagesFolderRef.current = undefined
		if (selectedProjectId && selectedProject) {
			projectFilesStore.setSelectedProject(selectedProject)
			// Initialize attachment loading promise
			recordSummaryFileStore.initLoadAttachments(selectedProjectId)
			updateAttachments(selectedProject, ({ list }) => {
				// 初始化场景，设置笔记的 last_updated_at
				const noteFileId = recordSummaryService.getPresetFiles()?.note_file?.file_id

				const targetFile = list.find((item) => item.file_id === noteFileId)

				if (targetFile) {
					recordSummaryService.updateNoteLastUpdatedAt(targetFile?.updated_at)
				}
			})
		}
	}, [
		isManagedByMobileRecordingPage,
		selectedProjectId,
		projectFilesStore,
		recordSummaryFileStore,
		updateAttachments,
	])

	// Get preset files (note and transcript) for current recording session
	const presetFiles = recordSummaryService.getPresetFiles()
	const noteFile = presetFiles?.note_file

	// Extract directory path from note file path for images folder
	// note_file.file_path format: "recording/session-xxx/note.md"
	// We need "recording/session-xxx" for the directory
	const displayDirPath = useMemo(() => {
		if (!noteFile?.file_path) return undefined
		const lastSlashIndex = noteFile.file_path.lastIndexOf("/")
		return lastSlashIndex > 0 ? noteFile.file_path.substring(0, lastSlashIndex) : undefined
	}, [noteFile?.file_path])

	// Get note file path (use preset file path directly)
	const noteFilePath = noteFile?.file_path ? `/${noteFile.file_path}` : ""

	/**
	 * Resolve or create the images folder under asr_display_dir before an image upload.
	 * Uses note_file.parent_id (= asr_display_dir.directory_id) as the parent.
	 */
	const resolveImagesFolderParentId = useMemoizedFn(async (folderPath: string) => {
		if (!selectedProjectId) return undefined

		// asr_display_dir.directory_id is the parent of the note file
		const displayDirId = recordSummaryService.getAsrDisplayDir()?.directory_id
		if (!displayDirId) return undefined

		// Extract the folder name (last segment of folderPath)
		const folderName = folderPath.split("/").filter(Boolean).pop() || "images"
		const cachedFolder = imagesFolderRef.current
		if (
			cachedFolder?.projectId === selectedProjectId &&
			cachedFolder.parentId === displayDirId &&
			cachedFolder.folderName === folderName
		) {
			return cachedFolder.folderId
		}
		const existingFolderId = findRecordingImagesFolderId(
			imageLookupAttachments,
			displayDirId,
			folderName,
		)
		if (existingFolderId) {
			imagesFolderRef.current = {
				projectId: selectedProjectId,
				parentId: displayDirId,
				folderName,
				folderId: existingFolderId,
			}
			return existingFolderId
		}

		try {
			const result = await SuperMagicApi.createFile(
				{
					project_id: selectedProjectId,
					parent_id: displayDirId,
					file_name: folderName,
					is_directory: true,
				},
				// Suppress toast when concurrent uploads hit an already-created images folder.
				{ enableErrorMessagePrompt: false },
			)
			const folderId = (result as any)?.file_id as string | undefined
			if (folderId) {
				imagesFolderRef.current = {
					projectId: selectedProjectId,
					parentId: displayDirId,
					folderName,
					folderId,
				}
			}
			return folderId
		} catch (error: unknown) {
			const errorObj = error as { code?: number }
			if (errorObj.code === SuperMagicApiErrorCode.DuplicateFile) {
				// A remounted panel has no cached id; query the hidden-inclusive tree again.
				const refreshed = await refreshRecordingAttachments(selectedProjectId)
				const existingFolderId = findRecordingImagesFolderId(
					refreshed.tree as AttachmentItem[],
					displayDirId,
					folderName,
				)
				if (existingFolderId) {
					imagesFolderRef.current = {
						projectId: selectedProjectId,
						parentId: displayDirId,
						folderName,
						folderId: existingFolderId,
					}
				}
				return existingFolderId
			}
			console.error("[RecordSummary] Failed to create images folder:", error)
			return undefined
		}
	})

	const handleImageUploadSuccess = useMemoizedFn(async () => {
		await refreshRecordingAttachments(selectedProjectId)
	})

	// URL resolver for project images - converts relative paths to download URLs.
	// Gate on attachments readiness so refresh restore does not resolve against an empty tree.
	const { urlResolver } = useImageUrlResolver({
		attachments: imageLookupAttachments as unknown as AttachmentFile[],
		relativeFilePath: noteFilePath,
		isReady:
			Boolean(selectedProjectId && noteFilePath) &&
			attachmentsReadyProjectId === selectedProjectId,
	})

	const isExpanded = recordingSummaryStore.isExpanded
	const isVisible = recordingSummaryStore.isVisible
	const isAudioRecordingProject = isAudioProjectMode(
		(recordingSummaryStore.businessData.project as { project_mode?: string | null } | null)
			?.project_mode,
	)
	const handleSave = useMemoizedFn(() => {
		recordSummaryService.flushNoteUpdate()
	})

	/**
	 * Toggles realtime transcription for the active PC session and persists the
	 * default_audio setting so the next recording uses the same preference.
	 */
	const handleTranscriptionEnabledChange = useMemoizedFn(async (enabled: boolean) => {
		if (isTranscriptionToggling) return

		setIsTranscriptionToggling(true)
		try {
			await recordSummaryService.setTranscriptionEnabledForCurrentSession(enabled)
			const apiResponse = await getRecordingTopicModel()
			const cachedSettings = getCachedRecordingSettings()
			const nextSettings = {
				transcription_enabled: enabled,
				auto_summary_enabled: resolveAutoSummaryEnabled(cachedSettings, apiResponse),
				model_id:
					cachedSettings?.model_id ||
					apiResponse.extra?.model?.model_id ||
					apiResponse.model?.model_id ||
					recordingSummaryStore.businessData.model?.model_id ||
					"",
			}

			await saveRecordingTopicModel(settingsToApiPayload(nextSettings, apiResponse))
			patchCachedRecordingSettings({ transcription_enabled: enabled })
		} catch {
			magicToast.error(t("mobile.recordingEntry.settings.saveFailed"))
		} finally {
			setIsTranscriptionToggling(false)
		}
	})

	useSandboxPreWarm({
		selectedTopic: recordingSummaryStore.businessData.chatTopic,
		projectId: recordingSummaryStore.businessData.project?.id,
		enabled: isVisible,
	})

	// Early return after all hooks have been called
	if (
		recordingSummaryStore.isOtherTabRecording ||
		shouldHideRecordingFloatPanel({
			isVisible: recordingSummaryStore.isVisible,
			isOnMobileRecordingsListRoute,
			isOnMobileRecordingDetailRoute,
		})
	) {
		return null
	}

	// Audio-recordings sessions (new mobile entry) use a dedicated new-style
	// indicator on other pages instead of the legacy global float panel.
	// At this point the policy has already ensured: isVisible, not on list/detail routes.
	if (isMobile && isAudioRecordingProject) {
		return (
			<MobileActiveRecordingIndicator
				duration={recordingSummaryStore.duration}
				isPaused={recordingSummaryStore.isPaused}
				onOpen={() => navigate({ name: RouteName.AudioRecordings })}
			/>
		)
	}

	if (isMobile) {
		return (
			<>
				<MobileFloatPanel
					editorRef={editorRef}
					expandedAiChat={recordingSummaryStore.floatPanel.expandedAiChat}
					onToggleExpandedAiChat={recordingSummaryStore.floatPanel.toggleExpandedAiChat}
					isRetrying={recordingSummaryStore.errorState.isRetrying}
					isWaitingSummarize={recordingSummaryStore.isWaitingSummarize}
					enableEnterAnimation={recordingSummaryStore.floatPanel.enableEnterAnimation}
					recordingStatus={recordingSummaryStore.status}
					isExpanded={isExpanded}
					selectedWorkspaceId={selectedWorkspaceId || ""}
					selectedProject={recordingSummaryStore.businessData.project}
					selectProjectDisabled={selectProjectDisabled}
					position={recordingSummaryStore.mobilePosition}
					editor={editor}
					onCompleteRecordingWithSummary={handleCompleteRecordingWithSummary}
					onCancelRecording={cancelRecord}
					onToggle={() => {
						recordingSummaryStore.floatPanel.setExpanded(!isExpanded)
					}}
					onRetryVoiceService={() => {
						return recordSummaryService.retryVoiceToTextService()
					}}
					duration={duration}
					message={message}
					hasVoiceError={recordingSummaryStore.errorState.hasVoiceError}
					onPositionChange={recordingSummaryStore.floatPanel.updateMobilePosition}
					onDraggingChange={recordingSummaryStore.floatPanel.setDragging}
					onProjectSelectConfirm={(data) => {
						if (data.project) {
							recordSummaryService.updateProject(data.project)
						}
					}}
					isPaused={recordingSummaryStore.isPaused}
					onPause={() => {
						recordSummaryService.pauseRecording()
					}}
					onResume={() => {
						recordSummaryService.continueRecording()
					}}
					isPausing={recordingSummaryStore.isPausing}
					isContinuing={recordingSummaryStore.isContinuing}
					projectFilesStore={projectFilesStore}
					attachments={attachments}
					attachmentList={attachmentList}
					checkNowDebounced={checkNowDebounced}
					onImageUploadSuccess={handleImageUploadSuccess}
					recordSummaryFileStore={recordSummaryFileStore}
					currentDocumentPath={noteFilePath}
					folderPath={
						displayDirPath ? getRecordingImagesDirPath(displayDirPath) : "images"
					}
					urlResolver={urlResolver}
					resolveImagesFolderParentId={resolveImagesFolderParentId}
					requireImagesFolderParentId
				/>
			</>
		)
	}

	return (
		<>
			<PcFloatPanel
				expandedAiChat={recordingSummaryStore.floatPanel.expandedAiChat}
				onToggleExpandedAiChat={recordingSummaryStore.floatPanel.toggleExpandedAiChat}
				isRetrying={recordingSummaryStore.errorState.isRetrying}
				isWaitingSummarize={recordingSummaryStore.isWaitingSummarize}
				enableEnterAnimation={recordingSummaryStore.floatPanel.enableEnterAnimation}
				isExpanded={isExpanded}
				recordingStatus={recordingSummaryStore.status}
				selectedProject={recordingSummaryStore.businessData.project}
				selectedWorkspaceId={selectedWorkspaceId || ""}
				selectProjectDisabled={selectProjectDisabled}
				position={recordingSummaryStore.pcPosition}
				editor={editor}
				onCancelRecording={cancelRecord}
				onToggle={() => {
					recordingSummaryStore.floatPanel.setExpanded(!isExpanded)
				}}
				onRetryVoiceService={() => {
					return recordSummaryService.retryVoiceToTextService()
				}}
				duration={duration}
				messages={message}
				hasVoiceError={recordingSummaryStore.errorState.hasVoiceError}
				onPositionChange={recordingSummaryStore.floatPanel.updatePcPosition}
				onDraggingChange={recordingSummaryStore.floatPanel.setDragging}
				onProjectSelectConfirm={(data) => {
					if (data.project) {
						recordSummaryService.updateProject(data.project)
					}
				}}
				isPaused={recordingSummaryStore.isPaused}
				onPause={() => {
					recordSummaryService.pauseRecording()
				}}
				onResume={() => {
					recordSummaryService.continueRecording()
				}}
				isPausing={recordingSummaryStore.isPausing}
				isContinuing={recordingSummaryStore.isContinuing}
				projectFilesStore={projectFilesStore}
				attachments={attachments}
				attachmentList={attachmentList}
				checkNowDebounced={checkNowDebounced}
				onImageUploadSuccess={handleImageUploadSuccess}
				recordSummaryFileStore={recordSummaryFileStore}
				urlResolver={urlResolver}
				currentDocumentPath={noteFilePath}
				folderPath={displayDirPath ? getRecordingImagesDirPath(displayDirPath) : "images"}
				editorRef={editorRef}
				onSave={handleSave}
				resolveImagesFolderParentId={resolveImagesFolderParentId}
				requireImagesFolderParentId
				isAudioProjectMode={isAudioRecordingProject}
				processingMode={recordingSummaryStore.processingMode}
				transcriptionEnabled={recordingSummaryStore.businessData.transcriptionEnabled}
				isTranscriptionToggling={isTranscriptionToggling}
				onTranscriptionEnabledChange={handleTranscriptionEnabledChange}
			/>
		</>
	)
}

export default observer(RecordingSummaryFloatPanel)
