import { observer } from "mobx-react-lite"
import { useEffect, useCallback, useMemo, useState, useRef } from "react"
import { reaction } from "mobx"
import recordingSummaryStore from "@/opensource/stores/recordingSummary"
import { initializeService } from "@/opensource/services/recordSummary/serviceInstance"
import { getRecordingImagesDirPath } from "@/opensource/services/recordSummary/const/files"
import useCancelRecord from "@/opensource/components/business/RecordingSummary/hooks/useCancelRecord"
import PcFloatPanel from "./components/PcFloatPanel"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import MobileFloatPanel from "./components/MobileFloatPanel"
import { onSummarizeSuccessDefaultCallback } from "./utils/callback"
import { useMemoizedFn, useDebounceFn, useUpdateEffect } from "ahooks"
import { ProjectFilesStore } from "@/opensource/stores/projectFiles"
import { useAttachmentsPolling } from "@/opensource/pages/superMagic/hooks/useAttachmentsPolling"
import { createMentionPanelStore } from "@/opensource/components/business/MentionPanel/store"
import pubsub from "@/opensource/utils/pubsub"
import { useImageUrlResolver } from "@/opensource/pages/superMagic/components/Detail/contents/Md/hooks/useImageUrlResolver"
import { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"
import { useFileChangeCheck } from "./hooks/useFileChangeCheck"
import { SimpleEditorRef } from "@/opensource/components/tiptap-templates/simple/simple-editor"
import { SuperMagicApi } from "@/opensource/apis"

/**
 * 录音纪要浮动面板
 */
export interface RecordingSummaryFloatPanelProps {}

export function RecordingSummaryFloatPanel() {
	const isMobile = useIsMobile()
	const recordSummaryService = initializeService()

	const editorRef = useRef<SimpleEditorRef>(null)
	// Create projectFilesStore for managing workspace files
	// Used by both AiChat and image URL resolution
	const { projectFilesStore, recordSummaryFileStore } = useMemo(() => {
		const projectFilesStore = new ProjectFilesStore()
		const recordSummaryFileStore = createMentionPanelStore(projectFilesStore)
		return { projectFilesStore, recordSummaryFileStore }
	}, [])

	// Attachment state management
	const [attachments, _setAttachments] = useState<any[]>([])
	const [attachmentList, _setAttachmentList] = useState<any[]>([])

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
	const { handleAttachmentsChange } = useFileChangeCheck({
		currentContent: currentNoteContent,
		onAttachmentsChange: ({ tree }) => {
			setAttachments(tree)
		},
		onMergedResult: (mergedContent) => {
			editorRef?.current?.editor?.commands.setContent(mergedContent)
			editorRef?.current?.editor?.commands.focus()
			recordSummaryService.updateNote(mergedContent)
		},
	})

	// Update attachments from API
	const { run: updateAttachments } = useDebounceFn(
		(
			selectedProject: any,
			callback?: (res: { tree: AttachmentItem[]; list: AttachmentItem[] }) => void,
		) => {
			if (!selectedProject?.id) {
				setAttachments([])
				projectFilesStore.setWorkspaceFileTree([])
				return
			}
			try {
				pubsub.publish("update_attachments_loading", true)
				SuperMagicApi.getAttachmentsByProjectId({
					projectId: selectedProject?.id,
					// @ts-ignore 使用window添加临时的token
					temporaryToken: window.temporary_token || "",
				})
					.then((res: any) => {
						setAttachments(res?.tree || [])
						recordSummaryFileStore.finishLoadAttachmentsPromise(selectedProject?.id)
						callback?.(res)
					})
					.finally(() => {
						pubsub.publish("update_attachments_loading", false)
					})
			} catch (error) {
				console.error("Failed to fetch attachments:", error)
				setAttachments([])
				projectFilesStore.setWorkspaceFileTree([])
				callback?.({ tree: [], list: [] })
			}
		},
		{
			wait: 500,
		},
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

	const { cancelRecord } = useCancelRecord({
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
		onAttachmentsChange: handleAttachmentsChange,
	})

	// Initialize attachments when project changes
	useEffect(() => {
		const selectedProject = recordingSummaryStore.businessData.project
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
	}, [selectedProjectId, projectFilesStore, recordSummaryFileStore, updateAttachments])

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

	// URL resolver for project images - converts relative paths to download URLs
	// Uses shared utility functions for consistent image resolution across the app
	const { urlResolver } = useImageUrlResolver({
		attachments,
		relativeFilePath: noteFilePath,
	})

	const isExpanded = recordingSummaryStore.isExpanded
	const isVisible = recordingSummaryStore.isVisible
	useEffect(() => {
		if (!isExpanded || !isVisible) {
			return
		}
		if (selectedProjectId) {
			// @ts-ignore
			window.project_id = selectedProjectId
		}

		return () => {
			// @ts-ignore
			window.project_id = ""
		}
	}, [selectedProjectId, isExpanded, isVisible])

	const handleSave = useMemoizedFn(() => {
		recordSummaryService.flushNoteUpdate()
	})

	// Early return after all hooks have been called
	if (!recordingSummaryStore.isVisible) {
		return null
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
					recordSummaryFileStore={recordSummaryFileStore}
					currentDocumentPath={noteFilePath}
					folderPath={
						displayDirPath ? getRecordingImagesDirPath(displayDirPath) : "images"
					}
					urlResolver={urlResolver}
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
				recordSummaryFileStore={recordSummaryFileStore}
				urlResolver={urlResolver}
				currentDocumentPath={noteFilePath}
				folderPath={displayDirPath ? getRecordingImagesDirPath(displayDirPath) : "images"}
				editorRef={editorRef}
				onSave={handleSave}
			/>
		</>
	)
}

export default observer(RecordingSummaryFloatPanel)
