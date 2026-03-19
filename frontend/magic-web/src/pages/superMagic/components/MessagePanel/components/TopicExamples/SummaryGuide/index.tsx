import { useState, useEffect, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useMemoizedFn } from "ahooks"
import CursorIcon from "../icons/Cursor.svg"
import { useStyles } from "./styles"
import MicrophoneIcon from "@/components/business/RecordingSummary/components/StartRecordingButton/MicrophoneIcon"
import { useTranslation } from "react-i18next"
import { IconFileUpload, IconKeyboard, IconMusicUp } from "@tabler/icons-react"
import { GuideTourElementId } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import { RecordingSummaryEditorMode } from "@/pages/superMagic/components/MessagePanel/const/recordSummary"

export const SummaryGuideDOMId = {
	StartRecordingButton: "recording-guide-start-recording-button",
	SelectProjectButton: "recording-guide-select-project-button",
	UploadVideoFileButton: "recording-guide-upload-video-file-button",
	SwitchActionButton: "recording-guide-switch-action-button",
	SwitchRecordingActionButton: "recording-guide-switch-recording-action-button",
	SwitchEditingActionButton: "recording-guide-switch-editing-action-button",
	UploadAttachmentButton: GuideTourElementId.UploadFileButton,
	MessageEditorContent: "recording-guide-message-editor-content",
}

export enum SummaryGuideType {
	StartRecording = "startRecording",
	UploadVideoFile = "uploadVideoFile",
	EditPrompt = "editPrompt",
}

interface SummaryGuideProps {
	/** 当前步骤类型 */
	type: SummaryGuideType | null
	/** 关闭回调 */
	onClose?: () => void
	/** 完成回调 */
	onFinish?: () => void
}

interface TargetRect {
	top: number
	left: number
	width: number
	height: number
}

interface GuideConfig {
	targetId: string
	popoverWidth?: number
	showExampleButton: boolean
	description: string
	showCloseButton: boolean
	showNextButton: boolean
	showFinishButton: boolean
	renderExampleButton?: () => React.ReactNode
	onActivate?: () => void
	/** 在镂空区域显示的内容 */
	highlightContent?: () => React.ReactNode
}

function SummaryGuide({ type, onClose, onFinish }: SummaryGuideProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
	const popoverRef = useRef<HTMLDivElement>(null)
	const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(
		null,
	)

	const [step, setStep] = useState<number>(0)

	const [originalEditorMode, setOriginalEditorMode] = useState<RecordingSummaryEditorMode | null>(
		null,
	)

	const beforeChangeEditorMode = useMemoizedFn((type: RecordingSummaryEditorMode) => {
		const recordingButtonElement = document.getElementById(
			SummaryGuideDOMId.SwitchRecordingActionButton,
		)
		if (recordingButtonElement) {
			const isRecordingMode = recordingButtonElement.getAttribute("data-isChecked") === "true"
			setOriginalEditorMode(
				isRecordingMode
					? RecordingSummaryEditorMode.Recording
					: RecordingSummaryEditorMode.Editing,
			)
		}
		changeEditorMode(type)
	})

	const changeEditorMode = useMemoizedFn((type: RecordingSummaryEditorMode) => {
		const targetId =
			type === RecordingSummaryEditorMode.Editing
				? SummaryGuideDOMId.SwitchEditingActionButton
				: SummaryGuideDOMId.SwitchRecordingActionButton
		const targetElement = document.getElementById(targetId)
		if (targetElement) {
			targetElement.click()
		}
	})

	const GUIDE_CONFIG: Record<SummaryGuideType, GuideConfig[]> = useMemo(() => {
		return {
			[SummaryGuideType.StartRecording]: [
				{
					targetId: SummaryGuideDOMId.StartRecordingButton,
					showExampleButton: true,
					renderExampleButton: () => (
						<div className={styles.startRecordingButton}>
							<MicrophoneIcon />
							<div>{t("guide.summaryGuide.startRecording")}</div>
						</div>
					),
					description: t("guide.summaryGuide.startRecordingDescription"),
					showNextButton: true,
					showCloseButton: true,
					showFinishButton: false,
					onActivate: () => {
						beforeChangeEditorMode(RecordingSummaryEditorMode.Recording)
					},
				},
				{
					targetId: SummaryGuideDOMId.SelectProjectButton,
					showExampleButton: true,
					renderExampleButton: () => (
						<div className={styles.selectProjectButton}>
							{t("guide.summaryGuide.selectProject")}
						</div>
					),
					description: t("guide.summaryGuide.selectProjectDescription"),
					showNextButton: false,
					showCloseButton: false,
					showFinishButton: true,
				},
			],
			[SummaryGuideType.UploadVideoFile]: [
				{
					targetId: SummaryGuideDOMId.UploadVideoFileButton,
					showExampleButton: true,
					renderExampleButton: () => (
						<div className={styles.primaryButton}>
							<div className={styles.primaryButtonIcon}>
								<IconMusicUp size={16} />
							</div>
							<div>{t("guide.summaryGuide.uploadAudioFile")}</div>
						</div>
					),
					description: t("guide.summaryGuide.uploadAudioFileDescription"),
					showNextButton: false,
					showCloseButton: false,
					showFinishButton: true,
					onActivate: () => {
						beforeChangeEditorMode(RecordingSummaryEditorMode.Recording)
					},
				},
			],
			[SummaryGuideType.EditPrompt]: [
				{
					targetId: SummaryGuideDOMId.SwitchActionButton,
					showExampleButton: true,
					renderExampleButton: () => (
						<div className={styles.primaryButton}>
							<div className={styles.primaryButtonIcon}>
								<IconKeyboard size={16} />
							</div>
							<div>{t("guide.summaryGuide.keyboardInput")}</div>
						</div>
					),
					description: t("guide.summaryGuide.keyboardInputDescription"),
					showNextButton: true,
					showCloseButton: true,
					showFinishButton: false,
					onActivate: () => {
						beforeChangeEditorMode(RecordingSummaryEditorMode.Editing)
					},
				},
				{
					targetId: SummaryGuideDOMId.UploadAttachmentButton,
					showExampleButton: true,
					renderExampleButton: () => (
						<div className={styles.primaryButton}>
							<div className={styles.primaryButtonIcon}>
								<IconFileUpload size={16} />
							</div>
							<div>{t("guide.summaryGuide.uploadAttachment")}</div>
						</div>
					),
					description: t("guide.summaryGuide.uploadAttachmentDescription"),
					showNextButton: true,
					showCloseButton: true,
					showFinishButton: false,
				},
				{
					targetId: SummaryGuideDOMId.MessageEditorContent,
					showExampleButton: false,
					highlightContent: () => (
						<div className={styles.editorHighlightContent}>
							{t("guide.summaryGuide.editorHighlightText")}
						</div>
					),
					description: t("guide.summaryGuide.messageEditorDescription"),
					showNextButton: false,
					showCloseButton: false,
					showFinishButton: true,
				},
			],
		}
	}, [
		t,
		styles.startRecordingButton,
		styles.selectProjectButton,
		styles.primaryButton,
		styles.primaryButtonIcon,
		styles.editorHighlightContent,
		beforeChangeEditorMode,
	])

	const config = useMemo(() => {
		return type ? GUIDE_CONFIG[type]?.[step] : null
	}, [GUIDE_CONFIG, type, step])

	// 获取目标元素位置
	const updateTargetRect = useMemoizedFn(() => {
		if (!config) return

		const targetElement = document.getElementById(config.targetId)
		if (targetElement) {
			const rect = targetElement.getBoundingClientRect()
			setTargetRect({
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
			})
		}
	})

	const handleClose = useMemoizedFn(() => {
		if (originalEditorMode) {
			changeEditorMode(originalEditorMode)
		}
		setStep(0)
		onClose?.()
	})

	const handleNext = useMemoizedFn(() => {
		setStep(step + 1)
	})

	const handleFinish = useMemoizedFn(() => {
		if (originalEditorMode) {
			changeEditorMode(originalEditorMode)
		}
		setStep(0)
		onFinish?.()
	})

	// 计算popover位置
	useEffect(() => {
		if (!targetRect || !popoverRef.current) return

		const popoverRect = popoverRef.current.getBoundingClientRect()
		const highlightPadding = 4 // 镂空框的padding
		const overflowOffset = -6 // 让Cursor图标指尖触及镂空框下边界附近
		const safeAreaPadding = 8 // 视口边缘安全距离

		// 镂空框下边界 = 目标元素底部 + highlightPadding
		// popover顶部 = 镂空框下边界 + overflowOffset
		let top = targetRect.top + targetRect.height + highlightPadding + overflowOffset
		let left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2

		// 确保不超出视口
		const viewportWidth = window.innerWidth
		const viewportHeight = window.innerHeight

		if (left < safeAreaPadding) left = safeAreaPadding
		if (left + popoverRect.width > viewportWidth - safeAreaPadding) {
			left = viewportWidth - popoverRect.width - safeAreaPadding
		}
		if (top + popoverRect.height > viewportHeight - safeAreaPadding) {
			// 如果下方放不下，放到上方
			top = targetRect.top - highlightPadding - popoverRect.height + 6
		}

		setPopoverPosition({ top, left })
	}, [targetRect])

	// 当 step 变化时，重新获取目标元素位置
	useEffect(() => {
		if (!config) return

		// 重置 popover 位置，避免使用旧的位置
		setPopoverPosition(null)

		setTimeout(() => {
			// 获取新的目标元素位置
			const targetElement = document.getElementById(config.targetId)
			if (targetElement) {
				const rect = targetElement.getBoundingClientRect()
				setTargetRect({
					top: rect.top,
					left: rect.left,
					width: rect.width,
					height: rect.height,
				})
			}
		}, 0)
	}, [step, config])

	// 监听窗口大小变化
	useEffect(() => {
		const handleResize = () => {
			updateTargetRect()
		}

		window.addEventListener("resize", handleResize)
		window.addEventListener("scroll", handleResize, true)

		return () => {
			window.removeEventListener("resize", handleResize)
			window.removeEventListener("scroll", handleResize, true)
		}
	}, [updateTargetRect])

	useEffect(() => {
		if (config?.onActivate) {
			config.onActivate()
		}
	}, [config])

	if (!config || !targetRect) return null

	return createPortal(
		<AnimatePresence>
			<div className={styles.guideOverlay}>
				{/* 遮罩层 - 使用SVG实现镂空效果 */}
				{targetRect && (
					<svg className={styles.guideMask} width="100%" height="100%">
						<defs>
							<mask id="guide-mask">
								<rect width="100%" height="100%" fill="white" />
								<rect
									x={targetRect.left - 4}
									y={targetRect.top - 4}
									width={targetRect.width + 8}
									height={targetRect.height + 8}
									rx={8}
									fill="black"
								/>
							</mask>
						</defs>
						<rect
							width="100%"
							height="100%"
							fill="rgba(0, 0, 0, 0.5)"
							mask="url(#guide-mask)"
						/>
					</svg>
				)}

				{/* 高亮边框 */}
				{targetRect && (
					<div
						className={styles.guideHighlight}
						style={{
							top: targetRect.top - 4,
							left: targetRect.left - 4,
							width: targetRect.width + 8,
							height: targetRect.height + 8,
						}}
					/>
				)}

				{/* 镂空区域内容（当配置了 highlightContent 时显示） */}
				{targetRect && config?.highlightContent && (
					<div
						className={styles.guideHighlightText}
						style={{
							top: targetRect.top - 4,
							left: targetRect.left - 4,
							width: targetRect.width + 8,
							height: targetRect.height + 8,
						}}
					>
						{config.highlightContent()}
					</div>
				)}

				{/* Popover */}
				{targetRect && (
					<motion.div
						ref={popoverRef}
						className={styles.guidePopoverContainer}
						style={{
							width: config.popoverWidth ?? 300,
							top: popoverPosition?.top ?? targetRect.top + targetRect.height + 4 - 6,
							left:
								popoverPosition?.left ??
								targetRect.left + targetRect.width / 2 - 145,
						}}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 10 }}
						transition={{ duration: 0.2 }}
					>
						{/* Cursor图标 */}
						<img
							src={CursorIcon}
							alt=""
							className={styles.guideCursor}
							draggable={false}
						/>

						{/* Popover内容 */}
						<div className={styles.guidePopover}>
							<div className={styles.guidePopoverContent}>
								{/* 标题行 */}
								{config.showExampleButton && (
									<div className={styles.guidePopoverTitleRow}>
										<div>{t("guide.click")}</div>
										{config.renderExampleButton && config.renderExampleButton()}
									</div>
								)}

								{/* 描述 */}
								<div className={styles.guidePopoverDescription}>
									{config.description}
								</div>
							</div>

							{/* 按钮组 */}
							<div className={styles.guidePopoverButtonGroup}>
								{config.showCloseButton && (
									<button
										type="button"
										className={cx(
											styles.guidePopoverButton,
											styles.guidePopoverButtonText,
										)}
										onClick={handleClose}
									>
										{t("guide.close")}
									</button>
								)}
								{config.showNextButton && (
									<button
										type="button"
										className={cx(
											styles.guidePopoverButton,
											styles.guidePopoverButtonOutline,
										)}
										onClick={handleNext}
									>
										{t("guide.next")}
									</button>
								)}
								{config.showFinishButton && (
									<button
										type="button"
										className={cx(
											styles.guidePopoverButton,
											styles.guidePopoverButtonOutline,
											styles.guidePopoverButtonFull,
										)}
										onClick={handleFinish}
									>
										{t("guide.finish")}
									</button>
								)}
							</div>
						</div>
					</motion.div>
				)}
			</div>
		</AnimatePresence>,
		document.body,
	)
}

export default SummaryGuide
