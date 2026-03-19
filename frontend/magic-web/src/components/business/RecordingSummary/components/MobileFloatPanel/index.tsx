import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"
import {
	IconMicrophone,
	IconPlayerStopFilled,
	IconWindowMinimize,
	IconWritingSign,
	IconSparkles,
	IconX,
} from "@tabler/icons-react"
import AudioVisualizer from "../AudioVisualizer"
import { useStyles } from "./style"
import FlexBox from "@/components/base/FlexBox"
import { cx } from "antd-style"
import { useTouchDraggable } from "./useTouchDraggable"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import LoadingIcon from "../LoadingIcon"
import PcActionButton from "../ProjectSelector/Actions/PcActionButton"
import RetrySection from "../RetrySection"
import RetryButton from "../RetryButton"
import { RecordingStatus } from "@/types/recordSummary"
import PauseButton from "../PauseButton"
import { SimpleEditorRef } from "@/components/tiptap-templates/simple/simple-editor"
import MessageList from "../MessageList"
import AiChat from "../AiChat"
import { ProjectFilesStore } from "@/stores/projectFiles"
import { MentionPanelStore } from "@/components/business/MentionPanel/store"
import EditorBody from "@/pages/superMagic/components/Detail/contents/Md/components/EditorBody"
import { ProjectListItem, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { observer } from "mobx-react-lite"

export interface MobileFloatPanelProps {
	isWaitingSummarize: boolean
	enableEnterAnimation: boolean
	isExpanded: boolean
	recordingStatus: RecordingStatus
	selectedProject?: ProjectListItem | null
	selectedWorkspaceId: string
	editor?: {
		value: string
		onChange: (value: string) => void
	}
	onCompleteRecordingWithSummary: () => void
	onCancelRecording: () => void
	onToggle: () => void
	onRetryVoiceService: () => Promise<void>
	position: {
		x: number
		y: number
	}
	duration: string
	message: (VoiceResultUtterance & { add_time: number; id: string })[]
	hasVoiceError: boolean
	onPositionChange: (position: { x: number; y: number }, skipAdjustment: boolean) => void
	onDraggingChange: (isDragging: boolean) => void
	mode?: "preview" | "edit"
	onProjectSelectConfirm?: (data: {
		workspace: Workspace | null
		project: ProjectListItem | null
	}) => void
	selectProjectDisabled: boolean
	isRetrying: boolean
	isPaused: boolean
	onPause: () => void
	onResume: () => void
	isPausing: boolean
	isContinuing: boolean
	expandedAiChat: boolean
	onToggleExpandedAiChat: () => void
	projectFilesStore: ProjectFilesStore
	attachments: AttachmentItem[]
	attachmentList: AttachmentItem[]
	checkNowDebounced: () => void
	recordSummaryFileStore: MentionPanelStore
	currentDocumentPath: string
	folderPath: string
	urlResolver: (relativePath: string) => Promise<string>
	onImageUploadSuccess?: (relativePath: string) => void
	editorRef?: React.RefObject<SimpleEditorRef>
}

function MobileFloatPanel(props: MobileFloatPanelProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	const {
		isWaitingSummarize,
		enableEnterAnimation,
		isExpanded,
		recordingStatus,
		selectedProject,
		selectedWorkspaceId,
		expandedAiChat,
		onToggleExpandedAiChat,
		onCompleteRecordingWithSummary,
		onCancelRecording,
		onToggle,
		onRetryVoiceService,
		duration,
		message,
		hasVoiceError,
		position,
		onPositionChange,
		onDraggingChange,
		mode = "edit",
		editor,
		onProjectSelectConfirm,
		selectProjectDisabled,
		isRetrying,
		isPaused,
		onPause,
		onResume,
		isPausing,
		isContinuing,
		projectFilesStore,
		attachments,
		attachmentList,
		checkNowDebounced,
		recordSummaryFileStore,
		currentDocumentPath,
		folderPath,
		urlResolver,
		editorRef,
	} = props

	const { handleTouchDown, isDragging, isSnapping, elementRef } = useTouchDraggable({
		defaultPosition: position,
		disabled: isExpanded, // 只在收起状态下启用拖拽
		onPositionChange: (position) => {
			onPositionChange(position, true)
		},
		onDragEnd: (position) => {
			onPositionChange(position, false)
		},
	})

	const [editorPopup, setEditorPopup] = useState(false)

	// 同步拖拽状态到 Store
	useEffect(() => {
		onDraggingChange(isDragging)
	}, [isDragging, onDraggingChange])

	const messagesRef = useRef<HTMLDivElement>(null)

	const handleTakeNotes = useCallback(() => {
		setEditorPopup(true)
		editorRef?.current?.editor?.commands.focus()
	}, [editorRef])

	// Determine expand direction based on position
	const getExpandDirection = useCallback(() => {
		if (typeof window === "undefined") return "from-right"
		const screenWidth = window.innerWidth
		const isOnRightSide = position.x > screenWidth / 2
		return isOnRightSide ? "from-right" : "from-left"
	}, [position.x])

	const expandDirection = getExpandDirection()

	const isEditMode = mode === "edit"

	return (
		<>
			{recordingStatus !== "init" && (
				<div
					ref={elementRef}
					className={`${styles.container} collapsed ${expandDirection} ${isDragging ? "dragging" : ""
						} ${isSnapping ? "snapping" : ""}`}
					onClick={!isExpanded ? onToggle : undefined}
					onTouchStart={!isExpanded ? handleTouchDown : undefined}
					style={
						!isExpanded
							? {
								left: position.x,
								top: position.y,
							}
							: {}
					}
				>
					{!isExpanded && (
						<div className={cx(styles.microphoneIconCollapsed)}>
							<AudioVisualizer
								showDuration={false}
								lineColor="white"
								className={styles.microphoneIconCollapsedAudioVisualizer}
							/>
						</div>
					)}
				</div>
			)}
			<MagicPopup visible={recordingStatus !== "init" && isExpanded}>
				<FlexBox vertical className={cx(styles.expandedContainer, "expanded")}>
					{/* Header */}
					<FlexBox
						align="center"
						gap={10}
						justify="space-between"
						className={cx(styles.header)}
					>
						<FlexBox align="center" gap={10} className={styles.headerContent}>
							<div className={styles.recordingInfo}>
								<div className={styles.microphoneIcon}>
									<MagicIcon component={IconMicrophone} size={24} color="white" />
								</div>
								<FlexBox vertical gap={2}>
									<div className={styles.recordingTextSection}>
										<p className={styles.recordingTitle}>
											{t("recordingSummary.mobileFloatPanel.title")}
										</p>
									</div>
									{/* Audio visualizer - shows in both states but styled differently */}
									<div className={styles.recordingStatus}>
										<AudioVisualizer duration={duration} isPaused={isPaused} />
									</div>
								</FlexBox>
							</div>
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
							<button
								className={styles.cancelButton}
								onClick={onCancelRecording}
								disabled={isWaitingSummarize}
							>
								<MagicIcon
									component={IconPlayerStopFilled}
									size={20}
									color="currentColor"
								/>
								{/* {t("recordingSummary.mobileFloatPanel.actions.cancel")} */}
							</button>
						</FlexBox>

						<button className={styles.minimizeButton} onClick={onToggle}>
							<MagicIcon
								component={IconWindowMinimize}
								size={24}
								color="currentColor"
							/>
						</button>
					</FlexBox>

					<FlexBox
						align="center"
						gap={10}
						justify="space-between"
						className={styles.actionButtonWrapper}
					>
						<PcActionButton disabled={selectProjectDisabled} />
						<RetryButton
							isRetrying={isRetrying}
							onRetryVoiceService={onRetryVoiceService}
						/>
					</FlexBox>
					{isEditMode && hasVoiceError && (
						<RetrySection onRetryVoiceService={onRetryVoiceService} />
					)}
					{/* Content */}
					<div className={styles.content}>
						<>
							<div className={styles.gradientOverlay} />
							<MessageList
								ref={messagesRef}
								message={message}
								isExpanded={isExpanded}
							/>
						</>
					</div>

					{/* Footer */}
					<div className={styles.footer}>
						{isEditMode && (
							<button
								className={styles.actionButton}
								onClick={handleTakeNotes}
								disabled={isWaitingSummarize}
							>
								<MagicIcon
									component={IconWritingSign}
									size={18}
									color="currentColor"
								/>
								{t("recordingSummary.mobileFloatPanel.actions.takeNotes")}
							</button>
						)}

						{isEditMode && (
							<button
								className={cx(styles.actionButton)}
								onClick={() => onToggleExpandedAiChat()}
								disabled={isWaitingSummarize}
							>
								{isWaitingSummarize ? (
									<LoadingIcon size={18} color="white" />
								) : (
									<MagicIcon
										component={IconSparkles}
										size={18}
										color="currentColor"
									/>
								)}
								{t("recordingSummary.mobileFloatPanel.actions.aiChat")}
							</button>
						)}

						{/* Center floating summarize button */}
						{isEditMode && (
							<button
								className={styles.summarizeButton}
								onClick={onCompleteRecordingWithSummary}
								disabled={isWaitingSummarize}
							>
								{isWaitingSummarize ? (
									<LoadingIcon size={24} color="white" />
								) : (
									<p className={styles.summarizeButtonText}>
										{t("recordingSummary.mobileFloatPanel.actions.summarize")}
									</p>
								)}
							</button>
						)}
					</div>
				</FlexBox>
			</MagicPopup>

			<MagicPopup visible={editorPopup} onClose={() => setEditorPopup(false)}>
				<div className={styles.popupContainer}>
					<FlexBox
						align="center"
						gap={10}
						justify="space-between"
						className={styles.editorHeader}
					>
						<FlexBox align="center" gap={10}>
							<div className={styles.editorTitleIcon}>
								<MagicIcon component={IconWritingSign} size={24} color="white" />
							</div>
							<FlexBox vertical gap={4}>
								<span className={styles.editorTitleText}>
									{t("recordingSummary.ui.editorTitle")}
								</span>
								<div className={styles.recordingStatus}>
									<AudioVisualizer duration={duration} />
								</div>
							</FlexBox>
						</FlexBox>
						<button
							className={styles.closeButton}
							onClick={() => setEditorPopup(false)}
						>
							<MagicIcon component={IconX} size={24} color="currentColor" />
						</button>
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
							placeholder={t("recordingSummary.ui.editorPlaceholder")}
						/>
					)}
				</div>
			</MagicPopup>
			<MagicPopup
				// 只有展开状态下才显示 AI 聊天弹窗
				visible={isExpanded && expandedAiChat}
				onClose={() => onToggleExpandedAiChat()}
			>
				<FlexBox
					align="center"
					gap={10}
					justify="space-between"
					className={styles.editorHeader}
				>
					<FlexBox align="center" gap={10}>
						<div className={styles.aiChatTitleIcon}>
							<MagicIcon component={IconSparkles} size={24} color="white" />
						</div>
						<FlexBox vertical gap={4}>
							<span className={styles.editorTitleText}>
								{t("recordingSummary.mobileFloatPanel.actions.aiChat")}
							</span>
							<div className={styles.recordingStatus}>
								<AudioVisualizer duration={duration} />
							</div>
						</FlexBox>
					</FlexBox>
					<button className={styles.closeButton} onClick={() => onToggleExpandedAiChat()}>
						<MagicIcon component={IconX} size={24} color="currentColor" />
					</button>
				</FlexBox>
				<div className={styles.aiChatContainer}>
					<AiChat
						projectFilesStore={projectFilesStore}
						attachments={attachments}
						attachmentList={attachmentList}
						checkNowDebounced={checkNowDebounced}
						recordSummaryFileStore={recordSummaryFileStore}
					/>
				</div>
			</MagicPopup>
		</>
	)
}

export default observer(MobileFloatPanel)
