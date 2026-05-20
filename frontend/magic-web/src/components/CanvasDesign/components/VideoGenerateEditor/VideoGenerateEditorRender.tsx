import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ClipboardEvent,
} from "react"
import { ArrowUp, LoaderCircle, ZapIcon } from "lucide-react"
import { useUpdateEffect } from "ahooks"
import { Modal } from "antd"
import { toast } from "sonner"
import { useHostUiLocale } from "../../context/HostUiLocaleContext"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasSelectionUI } from "../../context/CanvasUIContext"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { ElementTypeEnum, type VideoElement } from "../../canvas/types"
import type { GenerateVideoRequest } from "../../types.magic"
import type { UseVideoEditorConfigOptions } from "./video-editor-config.types"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"
import { generateUUID } from "../../canvas/utils/utils"
import MessageEditor, { type MessageEditorRef } from "../MessageEditor/MessageEditor"
import { useMessageEditorMention } from "../MessageEditor/useMessageEditorMention"
import VideoEditorControls from "./VideoEditorControls"
import { useVideoEditorConfig } from "./useVideoEditorConfig"
import { validateReferenceAssetsByLimits } from "./video-editor-config.model"
import type { ReferenceResourcePanelItem, ReferenceResourcePanelSelectContext } from "../../types"
import type { ReferenceResourceSourceType } from "../MessageEditor/reference-assets/reference-resource.types"
import { ReferenceResourceDropSurface } from "../MessageEditor/reference-assets/ReferenceResourceDropSurface"
import {
	checkLocalReferenceResourceDrop,
	checkProjectReferenceResourceDrop,
	getReferenceResourceHoverState,
	getReferenceResourceLocalHoverState,
	normalizeProjectDropFiles,
	type ReferenceDropProjectFile,
	useReferenceResourceDrop,
} from "../MessageEditor/reference-assets/useReferenceResourcePanelDataService"
import styles from "./index.module.css"
import { createAndSubmitVideoGeneration } from "./createAndSubmitVideoGeneration"
import { useVideoPointsEstimate } from "./useVideoPointsEstimate"
import {
	getShouldSkipVideoPointsConfirm,
	setShouldSkipVideoPointsConfirm,
} from "./video-points-confirm.storage"

interface VideoGenerateEditorRenderProps {
	videoElement: VideoElement
	autoFocus?: boolean
	/** 与 autoFocus 联用：挂载后将光标置于提示词末尾 */
	autoFocusAtDocumentEnd?: boolean
	/** generateVideo 成功返回后触发，用于清除重试编辑态等 */
	onGenerateSubmitSucceeded?: () => void
	/** 成片后重新进入编辑器时仅按 generateVideoRequest 恢复，不合并临时草稿 */
	restoreOnMount?: UseVideoEditorConfigOptions["restoreOnMount"]
	submitTarget?: "current-element" | "new-element"
}

/** 画布内浮动的视频生成编辑器：提示词、模型、输入区与发送 */
export default function VideoGenerateEditorRender(props: VideoGenerateEditorRenderProps) {
	const {
		videoElement,
		autoFocus = false,
		autoFocusAtDocumentEnd = false,
		onGenerateSubmitSucceeded,
		restoreOnMount,
		submitTarget = "current-element",
	} = props
	const { t } = useCanvasDesignI18n()
	const hostUiLocale = useHostUiLocale()
	const shellNominalWidthPx = useMemo(
		() => getVideoEditorShellNominalWidthPx(hostUiLocale),
		[hostUiLocale],
	)
	const { selectedElements } = useCanvasSelectionUI()
	const { canvas } = useCanvas()
	const editorRef = useRef<MessageEditorRef>(null)
	const [hasEditorScrollbar, setHasEditorScrollbar] = useState(false)
	const [hasSourceListScrollbar, setHasSourceListScrollbar] = useState(false)
	const [isSending, setIsSending] = useState(false)
	const [hoveredMentionPath, setHoveredMentionPath] = useState<string | null>(null)
	const sendingRef = useRef(false)
	const isMountedRef = useRef(false)
	const hasScrollbar = hasEditorScrollbar || hasSourceListScrollbar

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const config = useVideoEditorConfig({
		videoElement,
		messageEditorRef: editorRef,
		...(restoreOnMount ? { restoreOnMount } : {}),
	})
	const { handlers } = config
	const estimateModelId = useMemo(() => {
		if (config.selectedModelId) return config.selectedModelId
		if (config.hasRestoredRef.current) return undefined

		const requestModelId = videoElement.generateVideoRequest?.model_id
		if (
			requestModelId &&
			config.modelOptions.some((option) => option.value === requestModelId)
		) {
			return requestModelId
		}

		const rootStorage = canvas?.magicConfigManager.config?.methods?.getRootStorage?.()
		const defaultModelId = rootStorage?.defaultGenerateVideoConfig?.model_id
		if (
			defaultModelId &&
			config.modelOptions.some((option) => option.value === defaultModelId)
		) {
			return defaultModelId
		}

		return config.modelOptions[0]?.value
	}, [
		canvas,
		config.hasRestoredRef,
		config.modelOptions,
		config.selectedModelId,
		videoElement.generateVideoRequest?.model_id,
	])
	const estimateRequest = useMemo(() => {
		if (!estimateModelId) return null
		const generation = {
			...(config.selectedAspectRatio ? { aspect_ratio: config.selectedAspectRatio } : {}),
			...(config.selectedResolution ? { resolution: config.selectedResolution } : {}),
			...(config.selectedDurationSeconds != null &&
			Number.isFinite(config.selectedDurationSeconds)
				? { duration_seconds: config.selectedDurationSeconds }
				: {}),
			...(config.selectedCompressionQuality
				? { compression_quality: config.selectedCompressionQuality }
				: {}),
		}
		return {
			model_id: estimateModelId,
			generation,
		}
	}, [
		estimateModelId,
		config.selectedAspectRatio,
		config.selectedResolution,
		config.selectedDurationSeconds,
		config.selectedCompressionQuality,
	])
	const estimateSignature = useMemo(() => {
		if (!estimateRequest) return null
		return buildVideoPointsEstimateSignature(estimateRequest)
	}, [estimateRequest])
	const { points: estimatedPoints, isLoading: isEstimateLoading } = useVideoPointsEstimate({
		request: estimateRequest,
		signature: estimateSignature,
		enabled: Boolean(estimateModelId),
	})

	const { matchableItems, mentionDataService, mentionExtension, mentionEnabled } =
		useMessageEditorMention({
			matchableItems: config.matchableItems,
			mentionEnabledOverride: config.modelOptions.length > 0,
			maxReferenceFiles: config.supportsReferenceAssets ? config.maxReferenceImages : 0,
			currentReferenceFiles: config.currentReferenceImages,
			isReferenceFileLimitReached: config.isReferenceImageLimitReached,
			referenceResourceType: config.referenceResourceType,
			assetLimits: config.supportsReferenceAssets ? config.referenceAssetLimits : undefined,
			currentAssetCounts: config.supportsReferenceAssets
				? config.referenceAssetCounts
				: undefined,
		})

	const { containerRef } = useElementPositionEffect({
		position: "bottom",
		offset: 12,
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Video)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "video-generate-editor",
		enableWheelForwarding: !hasScrollbar,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			containerRef.current = node
			floatingRef.current = node
		},
		[containerRef, floatingRef],
	)

	const saveDefaultGenerateVideoConfig = useCallback(
		(requestParams: GenerateVideoRequest) => {
			if (!canvas) return
			const methods = canvas.magicConfigManager.config?.methods
			if (methods?.getRootStorage && methods?.saveRootStorage) {
				const rootStorage = methods.getRootStorage() || {}
				methods.saveRootStorage({
					...rootStorage,
					defaultGenerateVideoConfig: {
						model_id: requestParams.model_id,
						input_mode: requestParams.input_mode,
						task: requestParams.task,
						generation: {
							aspect_ratio: requestParams.generation?.aspect_ratio,
							resolution: requestParams.generation?.resolution,
						},
					},
				})
			}
		},
		[canvas],
	)

	useUpdateEffect(() => {
		if (config.isRestoringRef.current || !config.hasRestoredRef.current) return
		saveDefaultGenerateVideoConfig({
			model_id: config.selectedModelId,
			input_mode: config.selectedInputMode,
			task: config.currentInputModeConfig?.task || "generate",
			generation: {
				aspect_ratio: config.selectedAspectRatio,
				resolution: config.selectedResolution,
			},
		})
	}, [
		config.currentInputModeConfig?.task,
		config.selectedModelId,
		config.selectedAspectRatio,
		config.selectedResolution,
		config.isRestoringRef,
		config.hasRestoredRef,
		saveDefaultGenerateVideoConfig,
	])

	useUpdateEffect(() => {
		if (!canvas || !config.hasRestoredRef.current) return
		if (config.ratioOption) {
			canvas.toolManager.getVideoGeneratorTool().setDefaultSize({
				width: config.ratioOption.width,
				height: config.ratioOption.height,
			})
			return
		}
		if (!config.selectedAspectRatio) return
		canvas.toolManager
			.getVideoGeneratorTool()
			.setDefaultSizeByAspectRatio(config.selectedAspectRatio)
	}, [config.ratioOption, config.selectedAspectRatio, canvas, config.hasRestoredRef])

	const handleSelectSource = useCallback(
		(source: ReferenceResourceSourceType) => {
			if (config.isUploading) return
			handlers.setPopoverOpen(false)
			if (source !== "local-upload") return
			handlers.triggerFileSelect()
		},
		[config.isUploading, handlers],
	)

	const handleMentionChange = useCallback(
		(paths: string[], currentPrompt: string) => {
			handlers.handleReferenceMentionPathsChange(paths)
			void currentPrompt
		},
		[handlers],
	)

	const handleProjectSelect = useCallback(
		(item: ReferenceResourcePanelItem, context?: ReferenceResourcePanelSelectContext) => {
			const selectedSlot = config.selectedResourceSlot
			if (!selectedSlot) return
			const nextFileInfo = {
				path: item.data.file_path,
				src: item.data.file_path,
				fileName: item.data.file_name,
			}
			if (selectedSlot.inputTab === "frame") {
				handlers.replaceFrameImageAt(selectedSlot.slotIndex, nextFileInfo)
			} else {
				handlers.replaceReferenceImageAt(selectedSlot.slotIndex, nextFileInfo)
			}
			context?.reset?.()
		},
		[config.selectedResourceSlot, handlers],
	)

	const canAcceptReferenceDrop = config.supportsReferenceAssets && !config.isUploading

	const canAcceptProjectFiles = useCallback(
		(files: ReferenceDropProjectFile[]) => {
			return checkProjectReferenceResourceDrop({
				isDropEnabled: canAcceptReferenceDrop,
				files,
				matchableItems,
				currentReferenceFiles: config.currentReferenceImages,
				maxReferenceFiles: config.maxReferenceImages,
			})
		},
		[
			canAcceptReferenceDrop,
			config.currentReferenceImages,
			config.maxReferenceImages,
			matchableItems,
		],
	)

	const canAcceptLocalFiles = useCallback(
		(files: File[]) => {
			return checkLocalReferenceResourceDrop({
				isDropEnabled: canAcceptReferenceDrop,
				files,
				accept: config.fileInputAccept,
				currentReferenceFileCount: config.currentReferenceImages.length,
				maxReferenceFiles: config.maxReferenceImages,
				assetLimits: config.referenceAssetLimits,
				currentAssetCounts: config.referenceAssetCounts,
			})
		},
		[
			canAcceptReferenceDrop,
			config.currentReferenceImages,
			config.maxReferenceImages,
			config.fileInputAccept,
			config.referenceAssetLimits,
			config.referenceAssetCounts,
		],
	)

	const getHoverDropState = useCallback(
		() =>
			getReferenceResourceHoverState({
				isDropEnabled: canAcceptReferenceDrop,
				currentReferenceFileCount: config.currentReferenceImages.length,
				maxReferenceFiles: config.maxReferenceImages,
				assetLimits: config.referenceAssetLimits,
				currentAssetCounts: config.referenceAssetCounts,
			}),
		[
			canAcceptReferenceDrop,
			config.currentReferenceImages,
			config.maxReferenceImages,
			config.referenceAssetLimits,
			config.referenceAssetCounts,
		],
	)

	const getLocalHoverState = useCallback(
		(dataTransfer: DataTransfer | null) =>
			getReferenceResourceLocalHoverState({
				isDropEnabled: canAcceptReferenceDrop,
				dataTransfer,
				accept: config.fileInputAccept,
				currentReferenceFileCount: config.currentReferenceImages.length,
				maxReferenceFiles: config.maxReferenceImages,
				assetLimits: config.referenceAssetLimits,
				currentAssetCounts: config.referenceAssetCounts,
			}),
		[
			canAcceptReferenceDrop,
			config.fileInputAccept,
			config.currentReferenceImages,
			config.maxReferenceImages,
			config.referenceAssetLimits,
			config.referenceAssetCounts,
		],
	)

	const handleProjectFilesDrop = useCallback(
		(files: ReferenceDropProjectFile[]) => {
			const normalizedFiles = normalizeProjectDropFiles(
				files,
				matchableItems,
				config.currentReferenceImages,
			)
			const existingReferencePathSet = new Set(config.currentReferenceImages)
			const nextFiles: ReferenceDropProjectFile[] = []
			const seenNextPathSet = new Set<string>()
			normalizedFiles.forEach((file) => {
				if (existingReferencePathSet.has(file.path)) return
				if (seenNextPathSet.has(file.path)) return
				seenNextPathSet.add(file.path)
				nextFiles.push(file)
			})
			const startSlot = config.currentReferenceImages.length
			nextFiles.forEach((file, index) => {
				handlers.replaceReferenceImageAt(startSlot + index, {
					path: file.path,
					src: file.path,
					fileName: file.fileName,
				})
			})
		},
		[config.currentReferenceImages, handlers, matchableItems],
	)

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLDivElement>) => {
			const files = Array.from(event.clipboardData.files)
			if (files.length === 0) return
			if (!canAcceptLocalFiles(files).accepted) return

			event.preventDefault()
			void handlers.uploadReferenceFiles(files)
		},
		[canAcceptLocalFiles, handlers],
	)

	const { overlayState, dragEvents } = useReferenceResourceDrop({
		isEnabled: true,
		checkProjectFiles: canAcceptProjectFiles,
		checkLocalFiles: canAcceptLocalFiles,
		getProjectHoverState: getHoverDropState,
		getLocalHoverState,
		onDropProjectFiles: handleProjectFilesDrop,
		onDropLocalFiles: handlers.uploadReferenceFiles,
	})

	const promptPlaceholder =
		config.currentInputModeConfig?.description?.trim() ||
		t("videoEditor.placeholder", "请输入您的视频创作需求")

	const submitVideoGeneration = useCallback(
		async (requestParams: GenerateVideoRequest) => {
			if (sendingRef.current) return
			if (!canvas || !config.selectedModelId || !config.prompt.trim()) return
			const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
			if (!(elementInstance instanceof VideoElementClass)) return
			sendingRef.current = true
			setIsSending(true)
			try {
				handlers.cancelPendingDraftPersistence()
				const submitted =
					submitTarget === "new-element"
						? await createAndSubmitVideoGeneration({
								canvas,
								sourceVideoElement: videoElement,
								request: requestParams,
							})
						: await (async () => {
								handlers.saveDraftRequest(requestParams)
								return elementInstance.generateVideo(requestParams)
							})()
				if (submitted) onGenerateSubmitSucceeded?.()
			} finally {
				sendingRef.current = false
				if (isMountedRef.current) setIsSending(false)
			}
		},
		[
			canvas,
			config.prompt,
			config.selectedModelId,
			handlers,
			onGenerateSubmitSucceeded,
			submitTarget,
			videoElement,
		],
	)

	const handleSend = useCallback(async () => {
		if (sendingRef.current || isEstimateLoading) return
		if (!canvas || !config.selectedModelId || !config.prompt.trim()) return
		const currentInputs = config.referenceImageInfos
		const validationIssues = validateReferenceAssetsByLimits(
			config.currentInputModeConfig,
			currentInputs,
		)
		if (validationIssues.length > 0) {
			const firstIssue = validationIssues[0]
			if (firstIssue.field === "total") {
				if (firstIssue.rule === "max") {
					toast.error(
						t("videoEditor.referenceAssetTotalMaxReached", {
							defaultValue: "参考素材最多可上传 {{max}} 个",
							max: firstIssue.expected,
						}),
					)
					return
				}
				toast.error(
					t("videoEditor.referenceAssetTotalMinNotMet", {
						defaultValue: "参考素材至少需要 {{min}} 个",
						min: firstIssue.expected,
					}),
				)
				return
			}

			const assetTypeLabel =
				firstIssue.field === "reference_images"
					? t("messageHistory.referenceImage", "参考图")
					: firstIssue.field === "reference_videos"
						? t("messageHistory.referenceVideo", "参考视频")
						: t("messageHistory.referenceAudio", "参考音频")

			if (firstIssue.rule === "max") {
				toast.error(
					t("videoEditor.referenceAssetTypeMaxReached", {
						defaultValue: "{{assetType}}最多可上传 {{max}} 个",
						assetType: assetTypeLabel,
						max: firstIssue.expected,
					}),
				)
				return
			}
			toast.error(
				t("videoEditor.referenceAssetTypeMinNotMet", {
					defaultValue: "{{assetType}}至少需要 {{min}} 个",
					assetType: assetTypeLabel,
					min: firstIssue.expected,
				}),
			)
			return
		}
		const requestParams = {
			...(handlers.buildRequestParams() as GenerateVideoRequest),
			video_id: generateUUID(),
		}
		const elementInstance = canvas.elementManager.getElementInstance(videoElement.id)
		if (!(elementInstance instanceof VideoElementClass)) return
		if (getShouldSkipVideoPointsConfirm() || estimatedPoints == null) {
			await submitVideoGeneration(requestParams)
			return
		}
		let shouldSkipNextConfirm = false
		const confirmOptions = {
			title: t("videoEditor.sendConfirmTitle", "消耗提示"),
			content: (
				<div
					className={styles.sendConfirmContent}
					data-testid="video-points-confirm-content"
				>
					<p className={styles.sendConfirmDescription}>
						{t("videoEditor.sendConfirmDescription", {
							defaultValue: "本次任务预计消耗约 {{points}} 积分，是否确认执行？",
							points: estimatedPoints,
						})}
					</p>
					<label className={styles.sendConfirmCheckboxRow}>
						<Checkbox
							data-testid="video-points-confirm-skip-checkbox"
							onCheckedChange={(checked) => {
								shouldSkipNextConfirm = checked === true
							}}
						/>
						<span className={styles.sendConfirmCheckboxLabel}>
							{t("videoEditor.sendConfirmSkip", "下次不再提示")}
						</span>
					</label>
				</div>
			),
			okText: t("videoEditor.sendConfirmOk", "确认执行"),
			okButtonProps: {
				"data-testid": "video-points-confirm-ok-button",
			},
			cancelButtonProps: {
				"data-testid": "video-points-confirm-cancel-button",
			},
			onOk: () => {
				setShouldSkipVideoPointsConfirm(shouldSkipNextConfirm)
				void submitVideoGeneration(requestParams)
			},
		}
		const injectedConfirmModal = canvas.magicConfigManager.config?.methods?.confirmModal
		if (injectedConfirmModal) {
			injectedConfirmModal(confirmOptions)
			return
		}
		Modal.confirm(confirmOptions)
	}, [
		canvas,
		config.currentInputModeConfig,
		config.prompt,
		config.referenceImageInfos,
		config.selectedModelId,
		estimatedPoints,
		handlers,
		isEstimateLoading,
		submitVideoGeneration,
		t,
		videoElement,
	])

	const sendButtonBusy = isSending || isEstimateLoading

	return (
		<ReferenceResourceDropSurface
			ref={setRefs}
			className={styles.videoMessageEditor}
			style={
				{
					"--video-editor-shell-nominal-width": `${shellNominalWidthPx}px`,
				} as CSSProperties
			}
			data-canvas-ui-component
			data-testid="video-generate-editor-root"
			dropOverlayState={overlayState}
			dragEvents={dragEvents}
		>
			<input
				ref={config.fileInputRef}
				type="file"
				accept={config.fileInputAccept}
				multiple
				style={{ display: "none" }}
				onChange={handlers.handleFileChange}
			/>
			<MessageEditor
				ref={editorRef}
				autoFocus={autoFocus}
				autoFocusAtDocumentEnd={autoFocusAtDocumentEnd}
				selectionPersistenceKey={`video-generate:${videoElement.id}`}
				fullWidth
				placeholder={promptPlaceholder}
				value={config.prompt}
				onChange={(value) => handlers.setPrompt(value)}
				onEnter={handleSend}
				onScrollbarChange={setHasEditorScrollbar}
				matchableItems={matchableItems}
				mentionDataService={mentionDataService}
				mentionExtension={mentionExtension}
				onMentionChange={handleMentionChange}
				onMentionItemHoverChange={setHoveredMentionPath}
				mentionEnabled={mentionEnabled}
				onPaste={handlePaste}
			/>
			<VideoEditorControls
				config={config}
				hoveredMentionPath={hoveredMentionPath}
				onSourceListScrollbarChange={setHasSourceListScrollbar}
				onPrepareResourceSlotSelection={handlers.prepareResourceSlotSelection}
				onSelectSource={handleSelectSource}
				onProjectSelect={handleProjectSelect}
				onFocusEditor={() => editorRef.current?.focus()}
				renderSendButton={() => (
					<Button
						className={styles.sendButton}
						onClick={handleSend}
						disabled={
							sendButtonBusy || !config.prompt.trim() || !config.selectedModelId
						}
						aria-busy={sendButtonBusy}
						data-testid="video-generate-editor-send-button"
					>
						{sendButtonBusy ? (
							<LoaderCircle size={16} className="animate-spin" />
						) : (
							<>
								{estimatedPoints != null ? (
									<>
										<ZapIcon size={16} fill="currentColor" />
										<span className={styles.sendButtonPoints}>
											{t("videoEditor.sendButtonEstimatedPoints", {
												defaultValue: "预计{{points}}",
												points: estimatedPoints,
											})}
										</span>
									</>
								) : (
									<ArrowUp size={16} />
								)}
							</>
						)}
					</Button>
				)}
			/>
		</ReferenceResourceDropSurface>
	)
}

/** 中文界面略窄；英文等其它语言略宽，避免输入时外壳宽度抖动 */
function getVideoEditorShellNominalWidthPx(languageCode: string | undefined): number {
	if (!languageCode) return 760
	const normalized = languageCode.toLowerCase().replace(/-/g, "_")
	if (normalized.startsWith("zh")) return 580
	return 760
}

function buildVideoPointsEstimateSignature(request: Partial<GenerateVideoRequest>): string {
	return JSON.stringify({
		model_id: request.model_id,
		generation: request.generation,
	})
}
