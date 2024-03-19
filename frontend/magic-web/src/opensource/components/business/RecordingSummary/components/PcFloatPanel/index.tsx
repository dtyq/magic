import { useEffect, useRef, useState } from "react"
import { useStyles } from "./style"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import {
	IconLayoutSidebarRightCollapse,
	IconLayoutSidebarRightExpand,
	IconMicrophone,
	IconPlayerStopFilled,
	IconWindowMaximize,
	IconWindowMinimize,
	IconWritingSign,
} from "@tabler/icons-react"
import AudioVisualizer from "../AudioVisualizer"
import { useTranslation } from "react-i18next"
import FlexBox from "@/opensource/components/base/FlexBox"
import MagicSplitter from "@/opensource/components/base/MagicSplitter"
import { useDraggable } from "./useDraggable"
import { VoiceResultUtterance } from "@/opensource/components/business/VoiceInput/services/VoiceClient/types"
import { PcSelectorButton } from "../ProjectSelector"
import RetrySection from "../RetrySection"
import RetryButton from "../RetryButton"
import { useBoolean, useMemoizedFn } from "ahooks"
import type { SimpleEditorRef } from "@/opensource/components/tiptap-templates/simple/simple-editor"
import PauseButton from "../PauseButton"
import { AudioSourceType, RecordingStatus } from "@/opensource/types/recordSummary"
import MessageList from "../MessageList"
import { Tooltip } from "antd"
import AiChat from "../AiChat"
import { ProjectFilesStore } from "@/opensource/stores/projectFiles"
import { MentionPanelStore } from "@/opensource/components/business/MentionPanel/store"
import { ProjectListItem, Workspace } from "@/opensource/pages/superMagic/pages/Workspace/types"
import EditorBody from "@/opensource/pages/superMagic/components/Detail/contents/Md/components/EditorBody"
import { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"
import { observer } from "mobx-react-lite"
import AudioSourceSelector from "../AudioSourceSelector"
import { RecordingDebugPanel } from "../RecordingDebugPanel"
import { initializeService } from "@/opensource/services/recordSummary/serviceInstance"
import recordSummaryStore from "@/opensource/stores/recordingSummary"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import {
	PermissionDeniedError,
	AudioSourceNotSupportedError,
	InvalidStateError,
	AudioStreamCaptureError,
	RecorderInitializationError,
	AudioSourceSwitchError,
} from "@/opensource/services/recordSummary/MediaRecorderService/types/RecorderErrors"
import { Editor } from "@tiptap/core"
import NoteUpdateStatus from "../NoteUpdateStatus"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { isDev } from "@/opensource/utils/env"

export interface PcFloatPanelProps {
	isWaitingSummarize: boolean
	enableEnterAnimation: boolean
	isExpanded: boolean
	isFullscreen?: boolean
	recordingStatus: RecordingStatus
	selectedProject?: ProjectListItem | null
	selectedWorkspaceId: string
	onProjectSelectConfirm?: (data: {
		workspace: Workspace | null
		project: ProjectListItem | null
	}) => void
	editor?: {
		value: string
		onChange: (value: string) => void
	}
	onCancelRecording: () => void
	onToggle: () => void
	onToggleFullscreen?: () => void
	onRetryVoiceService: () => Promise<void>
	position: {
		x: number
		y: number
	}
	duration: string
	messages: (VoiceResultUtterance & { add_time: number; id: string })[]
	hasVoiceError: boolean
	onPositionChange: (position: { x: number; y: number }, skipAdjustment: boolean) => void
	onDraggingChange: (isDragging: boolean) => void
	mode?: "preview" | "edit"
	selectProjectDisabled: boolean
	isPaused: boolean
	onPause: () => void
	onResume: () => void
	isPausing: boolean
	isContinuing: boolean
	isRetrying: boolean
	expandedAiChat: boolean
	onToggleExpandedAiChat: () => void
	projectFilesStore: ProjectFilesStore
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	checkNowDebounced: () => void
	recordSummaryFileStore: MentionPanelStore
	urlResolver: (relativePath: string) => Promise<string>
	currentDocumentPath: string
	folderPath: string
	onImageUploadSuccess?: (relativePath: string) => void
	editorRef?: React.RefObject<SimpleEditorRef>
	onSave?: (editor: Editor | null) => void
}

const PcFloatPanel = function PcFloatPanel(props: PcFloatPanelProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const {
		isWaitingSummarize,
		enableEnterAnimation,
		isExpanded,
		recordingStatus,
		selectedProject,
		selectedWorkspaceId,
		position,
		editor,
		onCancelRecording,
		onToggle,
		onRetryVoiceService,
		duration,
		hasVoiceError,
		messages,
		onPositionChange,
		onDraggingChange,
		onProjectSelectConfirm,
		mode = "edit",
		selectProjectDisabled,
		isPaused,
		onPause,
		onResume,
		isPausing,
		isContinuing,
		isRetrying,
		expandedAiChat,
		onToggleExpandedAiChat,
		projectFilesStore,
		attachments,
		attachmentList,
		checkNowDebounced,
		recordSummaryFileStore,
		urlResolver,
		currentDocumentPath,
		folderPath,
		editorRef,
		onSave,
	} = props

	const isEditMode = mode === "edit"

	const [enableAnimation, setEnableAnimation] = useState(false)
	// 用于存储动画定时器引用，便于清理
	const animationTimerRef = useRef<NodeJS.Timeout | null>(null)

	const [isFullscreen, { setTrue, setFalse }] = useBoolean(false)
	const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false)
	const isDevEnvironment = isDev

	const onToggleFullscreen = useMemoizedFn(() => {
		if (isFullscreen) {
			const currentEnableAnimation = enableAnimation
			if (currentEnableAnimation) {
				setEnableAnimation(false)
			}
			setFalse()

			setTimeout(() => {
				if (currentEnableAnimation) {
					setEnableAnimation(true)
				}
			}, 1000)
		} else {
			setTrue()
		}
	})

	const { isDragging, elementRef, handleMouseDown } = useDraggable({
		defaultPosition: position,
		onPositionChange: (position) => {
			// 拖拽过程中跳过位置调整，避免双重限制
			onPositionChange(position, true)
		},
		onDragEnd: (position) => {
			// 拖拽结束后进行完整的位置调整
			onPositionChange(position, false)
		},
		disabled: isExpanded || isFullscreen, // 展开或全屏时禁用拖拽
	})

	// 同步拖拽状态到 Store
	useEffect(() => {
		onDraggingChange(isDragging)
	}, [isDragging])

	const messagesRef = useRef<HTMLDivElement>(null)

	// 处理全选快捷键和ESC退出全屏
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// ESC键退出全屏
			if (event.key === "Escape" && isFullscreen && onToggleFullscreen) {
				event.preventDefault()
				onToggleFullscreen()
				return
			}

			// 只在面板展开且编辑器未聚焦状态下处理全选
			if (!isExpanded || editorRef?.current?.editor?.isFocused) return

			// 检查是否是 Ctrl+A (Windows/Linux) 或 Cmd+A (Mac)
			if ((event.ctrlKey || event.metaKey) && event.key === "a") {
				// 阻止默认的全选行为
				event.preventDefault()

				// 获取消息内容元素
				const messageContent = messagesRef?.current?.querySelector(
					`.${styles.messageContent}`,
				)
				if (messageContent) {
					// 创建选区并选中所有文本
					const selection = window.getSelection()
					if (selection) {
						const range = document.createRange()
						range.selectNodeContents(messageContent)
						selection.removeAllRanges()
						selection.addRange(range)
					}
				}
			}
		}

		// 添加事件监听器
		document.addEventListener("keydown", handleKeyDown)

		// 清理函数
		return () => {
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [
		styles.messageContent,
		isExpanded,
		isFullscreen,
		onToggleFullscreen,
		messagesRef,
		editorRef,
	])

	// 使用 useCallback 优化 handleToggle，添加性能监控
	const handleToggle = useMemoizedFn(() => {
		console.time("toggle-expand") // 性能监控

		// 清理之前的定时器
		if (animationTimerRef.current) {
			clearTimeout(animationTimerRef.current)
			animationTimerRef.current = null
		}

		if (isFullscreen) {
			setFalse()
			setEnableAnimation(true)
		}

		onToggle()
		setEnableAnimation(true)

		// 存储定时器引用以便清理
		animationTimerRef.current = setTimeout(() => {
			setEnableAnimation(false)
			console.timeEnd("toggle-expand") // 输出性能数据
			animationTimerRef.current = null
		}, 1000)
	})

	const [isSwitchingAudioSource, setIsSwitchingAudioSource] = useState(false)
	const selectedAudioSource = recordSummaryStore.audioSource

	const handleAudioSourceChange = useMemoizedFn(async (newSource: AudioSourceType) => {
		// If recording, switch source with auto-pause/resume
		setIsSwitchingAudioSource(true)
		try {
			const recordSummaryService = initializeService()
			await recordSummaryService?.switchAudioSource(newSource)
			magicToast.success(t("recordSummary:audioSource.switchSuccess"))
		} catch (error) {
			console.error("Failed to switch audio source:", error)

			// Get error message based on error type
			let errorMessage = t("recordSummary:audioSource.errors.unknown")

			if (error instanceof AudioSourceSwitchError) {
				// Check the underlying cause of the switch error
				const cause = error.cause

				if (cause instanceof PermissionDeniedError) {
					errorMessage = t("recordSummary:audioSource.errors.permissionDenied")
				} else if (cause instanceof AudioSourceNotSupportedError) {
					errorMessage = t("recordSummary:audioSource.errors.notSupported")
				} else if (cause instanceof AudioStreamCaptureError) {
					errorMessage = t("recordSummary:audioSource.errors.streamCaptureFailed")
				} else if (cause instanceof RecorderInitializationError) {
					errorMessage = t("recordSummary:audioSource.errors.initializationFailed")
				}
			} else if (error instanceof PermissionDeniedError) {
				errorMessage = t("recordSummary:audioSource.errors.permissionDenied")
			} else if (error instanceof AudioSourceNotSupportedError) {
				errorMessage = t("recordSummary:audioSource.errors.notSupported")
			} else if (error instanceof InvalidStateError) {
				errorMessage = t("recordSummary:audioSource.errors.invalidState")
			} else if (error instanceof AudioStreamCaptureError) {
				errorMessage = t("recordSummary:audioSource.errors.streamCaptureFailed")
			} else if (error instanceof RecorderInitializationError) {
				errorMessage = t("recordSummary:audioSource.errors.initializationFailed")
			}

			magicToast.error(errorMessage)
		} finally {
			setIsSwitchingAudioSource(false)
		}
	})

	// 获取展开样式（支持全屏状态）
	const getExpandedStyle = () => {
		if (isFullscreen) {
			return styles.fullscreen
		}
		if (!isExpanded) {
			return styles.collapsed
		}
		return styles.expanded
	}

	if (recordingStatus === "init") {
		return null
	}

	return (
		<>
			{/* {isFullscreen && <div className={styles.fullscreenOverlay} />} */}
			<div
				ref={elementRef}
				className={cx(
					styles.container,
					isDragging && styles.dragging,
					enableEnterAnimation && "enter-animation",
					isExpanded && "expanded",
					isFullscreen && "fullscreen",
				)}
				style={
					isExpanded || isFullscreen
						? {}
						: {
								left: position.x,
								top: position.y,
							}
				}
			>
				<div
					className={cx(
						styles.content,
						getExpandedStyle(),
						enableAnimation && "animation",
					)}
					style={{
						transformOrigin: "top left",
					}}
				>
					<MagicSplitter className={styles.contentSplitter}>
						<MagicSplitter.Panel defaultSize="70%" className={styles.contentLeft}>
							{/* Header - 始终显示 */}
							<div
								className={cx(
									styles.header,
									"recording-header",
									isExpanded && "expanded",
								)}
								style={{
									cursor: isExpanded ? "default" : "move",
								}}
								{...(!isExpanded && { onMouseDown: handleMouseDown })}
							>
								<div
									className={cx(
										styles.collapsedControls,
										isExpanded && styles.collapsedControlsExpanded,
									)}
								>
									<div className={styles.collapsedLeft}>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "8px",
											}}
										>
											<div className={styles.microphoneIcon}>
												<MagicIcon
													component={IconMicrophone}
													size={14}
													color="currentColor"
												/>
											</div>
											<span className={styles.recordingText}>
												{t("recordingSummary.status.recording")}
											</span>
										</div>
										<AudioVisualizer
											duration={duration}
											isPaused={recordingStatus === "paused"}
										/>
										{isEditMode && (
											<PauseButton
												isPaused={isPaused}
												onPause={onPause}
												onResume={onResume}
												isPausing={isPausing}
												isContinuing={isContinuing}
												disabled={isWaitingSummarize}
											/>
										)}
										{isEditMode && (
											<Tooltip
												title={t("recordingSummary.actions.stopRecording")}
											>
												<button
													className={cx(styles.cancelButton)}
													disabled={isWaitingSummarize}
													onClick={onCancelRecording}
												>
													<MagicIcon
														component={IconPlayerStopFilled}
														size={10}
														color="currentColor"
													/>
												</button>
											</Tooltip>
										)}
										{isExpanded && (
											<RetryButton
												isRetrying={isRetrying}
												onRetryVoiceService={onRetryVoiceService}
											/>
										)}
										{isExpanded && isEditMode && (
											<AudioSourceSelector
												value={selectedAudioSource}
												onChange={handleAudioSourceChange}
												disabled={isSwitchingAudioSource}
												size="small"
											/>
										)}
									</div>

									<div className={styles.collapsedRight}>
										<FlexBox
											align="center"
											gap={4}
											onClick={(event) => {
												event.stopPropagation()
											}}
										>
											{isExpanded && isEditMode && (
												<PcSelectorButton disabled />
											)}

											<button
												className={cx(
													styles.toggleButton,
													!isExpanded && "left-divider",
												)}
												onClick={handleToggle}
											>
												<MagicIcon
													component={
														isExpanded
															? IconWindowMinimize
															: IconWindowMaximize
													}
													size={18}
													color="rgba(28, 29, 35, 0.8)"
												/>
												{isExpanded
													? t("recordingSummary.ui.minimize")
													: t("recordingSummary.ui.expand")}
											</button>
											{isExpanded && (
												<button
													className={cx(styles.toggleButton)}
													onClick={() => onToggleExpandedAiChat()}
												>
													<MagicIcon
														component={
															expandedAiChat
																? IconLayoutSidebarRightCollapse
																: IconLayoutSidebarRightExpand
														}
														size={18}
														color="rgba(28, 29, 35, 0.8)"
													/>
													{expandedAiChat
														? t("recordingSummary.ui.collapseAiChat")
														: t("recordingSummary.ui.expandAiChat")}
												</button>
											)}
											{isDevEnvironment && isExpanded && isEditMode && (
												<MagicDropdown
													open={isDebugPanelOpen}
													onOpenChange={setIsDebugPanelOpen}
													placement="bottomRight"
													trigger={["click"]}
													popupRender={() => (
														<RecordingDebugPanel isOpen />
													)}
												>
													<button className={cx(styles.toggleButton)}>
														{isDebugPanelOpen
															? t("recordingSummary.debugPanel.close")
															: t("recordingSummary.debugPanel.open")}
													</button>
												</MagicDropdown>
											)}
										</FlexBox>
									</div>
								</div>
							</div>

							<MagicSplitter
								className={cx(styles.messagesContainer, "recording-messages")}
								hiddenSplitterBar={false}
							>
								<MagicSplitter.Panel
									className={styles.panelLeft}
									min={200}
									defaultSize="40%"
								>
									{/* Messages - 动画容器 */}
									<div style={{ position: "relative", height: "100%" }}>
										{isEditMode && hasVoiceError && (
											<RetrySection
												onRetryVoiceService={onRetryVoiceService}
											/>
										)}
										<MessageList
											ref={messagesRef}
											message={messages}
											isExpanded={isExpanded}
										/>
									</div>
								</MagicSplitter.Panel>
								{isEditMode && (
									<MagicSplitter.Panel min={340} defaultSize="60%">
										<FlexBox vertical className={styles.editorContainer}>
											<FlexBox
												className={styles.editorTitle}
												align="center"
												justify="space-between"
											>
												<FlexBox align="center" gap={4}>
													<div className={styles.editorTitleIcon}>
														<MagicIcon
															component={IconWritingSign}
															size={14}
															color="white"
														/>
													</div>
													<span className={styles.editorTitleText}>
														{t("recordingSummary.ui.editorTitle")}
													</span>
												</FlexBox>
												<FlexBox align="center" gap={8}>
													<NoteUpdateStatus />
													<span className={styles.editorTitleTip}>
														{t("recordingSummary.ui.editorTitleTip")}
													</span>
												</FlexBox>
											</FlexBox>
											{editor && (
												<EditorBody
													isLoading={false}
													viewMode={"markdown"}
													content={editor.value}
													processedContent={editor.value}
													isEditMode={isEditMode}
													editContent={editor.value}
													setEditContent={editor.onChange}
													selectedProject={selectedProject}
													currentDocumentPath={currentDocumentPath}
													urlResolver={urlResolver}
													className={styles.editorBody}
													folderPath={folderPath}
													onImageUploadSuccess={checkNowDebounced}
													editorRef={editorRef}
													placeholder={t(
														"recordingSummary.ui.editorPlaceholder",
													)}
													onSave={onSave}
												/>
											)}
											{/* <FlexBox
												className={styles.editorFooter}
												align="center"
												justify="space-between"
											>
												<span className={styles.editorFooterChar}>
													{t("recordingSummary.ui.charactersCount", {
														count: editorState?.charactersCount ?? 0,
													})}{" "}
													/{" "}
													{t("recordingSummary.ui.charactersCount", {
														count: CHARACTER_COUNT_LIMIT,
													})}
												</span>
												<span className={styles.editorFooterTip}>
													{t("recordingSummary.ui.editorFooterTip")}
												</span>
											</FlexBox> */}
										</FlexBox>
									</MagicSplitter.Panel>
								)}
							</MagicSplitter>
						</MagicSplitter.Panel>
						{expandedAiChat && isExpanded && (
							<MagicSplitter.Panel
								defaultSize={380}
								max="50%"
								min={380}
								className={styles.contentRight}
							>
								<AiChat
									projectFilesStore={projectFilesStore}
									attachments={attachments}
									attachmentList={attachmentList}
									checkNowDebounced={checkNowDebounced}
									recordSummaryFileStore={recordSummaryFileStore}
								/>
							</MagicSplitter.Panel>
						)}
					</MagicSplitter>
				</div>
			</div>
			{isExpanded && <div className={styles.shadow} />}
		</>
	)
}

export default observer(PcFloatPanel)
