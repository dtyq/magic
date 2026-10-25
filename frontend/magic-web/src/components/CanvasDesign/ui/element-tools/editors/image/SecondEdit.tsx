import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEventListener, useLatest, useUnmount } from "ahooks"
import { ElementTypeEnum, type ImageElement } from "../../../../runtime/document/types"
import { useCanvasUI } from "../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { useMagic } from "../../../../app/providers/MagicProvider"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import styles from "./index.module.css"
import { type MessageEditorRef } from "../../../editors/message/MessageEditor"
import { ImageElement as ImageElementClass } from "../../../../runtime/elements/image/ImageElement"
import { ElementFactory } from "../../../../runtime/elements/core/ElementFactory"
import { generateElementId, getDefaultImageSize } from "../../../../runtime/shared/ids"
import { resolveDerivedRightPlacement } from "../../../../runtime/shared/placement/placementEngine"
import { getCanvasResourceFileName } from "../../../../runtime/shared/path/canvasResourcePath"
import { getImageProcessRequestPayload } from "../../../../runtime/resources/image/imageCropUtils"
import type { GenerateImageRequest } from "../../../../public/magic-types"
import { ElementToolTypeEnum } from "../../../../public/props"
import { useImageEditorConfig } from "./useImageEditorConfig"
import ImageEditorSurface from "./ImageEditorSurface"
import type { MediaResourceFullscreenPreviewItem } from "../../../fullscreen/media-resource/index"
import type { LinkedEditorInputsState } from "../../../editors/connection/useLinkedEditorInputs"
import { buildImageRequestWithLinkedEditorInputs } from "../../../editors/connection/linkedImageRequest"
import { createAndSubmitImageGeneration as createAndSubmitNewImageGeneration } from "./submit/createAndSubmitImageGeneration"
import {
	getActiveImageContent,
	getContentGenerationState,
} from "../../../../runtime/document/elementContent"
import { isEditorInteractiveKeyboardTarget } from "../../../editors/keyboard"
import { useCanvasEvent, useIsMediaReplacing } from "../../../../app/hooks/canvas"
import { useGenerationRuntime } from "../../../../app/hooks/canvas/useGenerationRuntime"
import {
	areMediaEditSnapshotsEqual,
	buildMediaEditSourceFingerprint,
	type MediaEditIntent,
} from "../../../../runtime/interaction/media-edit-recovery/MediaEditRecoveryManager"
import type { ImageEditSessionSnapshot } from "./useImageEditorConfig"
import { useElementToolCommand } from "../../model/useElementToolCommand"
import type { GenerationToolCommandRequest } from "../../../../runtime/element-tools"
import type { MediaEditorSubmissionController } from "../shared/useMediaEditorSubmission"

type SecondEditIntent = "quick-edit" | "re-edit" | "generate-again"

interface SecondEditProps {
	imageElement: ImageElement
	pendingToolCommand?: GenerationToolCommandRequest | null
	onPendingToolCommandHandled?: () => void
	onPreviewMediaResource?: (resource: MediaResourceFullscreenPreviewItem) => void
	isMediaResourcePreviewOpen?: boolean
	submissionController: MediaEditorSubmissionController
}

export default function SecondEdit(props: SecondEditProps) {
	const { pendingToolCommand, onPendingToolCommandHandled } = props
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { imageModelList, isLoadingImageModelList, methods } = useMagic()
	const { t } = useCanvasDesignI18n()
	const editorRef = useRef<MessageEditorRef>(null)
	const [pendingOpenMode, setPendingOpenMode] = useState<"quick-edit" | "regenerate" | null>(null)
	const [editingIntent, setEditingIntent] =
		useState<Extract<SecondEditIntent, "quick-edit" | "re-edit">>("quick-edit")
	const activeContent = getActiveImageContent(props.imageElement)
	const sessionStore = canvas?.mediaEditRecoveryManager
	const sessionContentId = activeContent.contentId
	const sessionSourceFingerprint = buildMediaEditSourceFingerprint(
		sessionContentId,
		activeContent.src,
	)
	const [sessionIntent, setSessionIntent] = useState<MediaEditIntent | null>(null)
	const [hasInterruptedDraft, setHasInterruptedDraft] = useState(false)
	const [pendingBaselineIntent, setPendingBaselineIntent] = useState<MediaEditIntent | null>(null)
	const previousSourceFingerprintRef = useRef(sessionSourceFingerprint)
	const sessionPersistenceEnabledRef = useRef(true)

	const getSessionKey = useCallback(
		(intent: MediaEditIntent) => ({
			elementId: props.imageElement.id,
			contentId: sessionContentId,
			intent,
		}),
		[props.imageElement.id, sessionContentId],
	)

	// 使用共享的配置 hook（ossSrc 会直接从实例中获取，因为二次编辑只有在 ossSrc 准备好后才会显示）
	const config = useImageEditorConfig({
		imageElement: props.imageElement,
		originalImageSrc: activeContent.src,
		manageRecoverySession: false,
		editorFocusRef: editorRef,
		originalImageName:
			// 从 src 字段提取文件名（例如："/超级画布/images/111.jpg" -> "111.jpg"）
			getCanvasResourceFileName(activeContent.src) ||
			props.imageElement.name ||
			t("imageEditor.originalImage", "原图"), // 从 src 提取文件名，否则使用 name，最后使用默认值
	})

	const { prompt, handlers } = config
	const { restoreQuickEditConfigToUi, restoreOriginalGenerateImageRequestToUi, setPrompt } =
		handlers

	const [isEditing, setIsEditing] = useState<boolean>(false)
	const [isVisible, setIsVisible] = useState<boolean>(true)
	const [isSending, setIsSending] = useState(false)
	const sendingRef = useRef(false)
	const isReplacing = useIsMediaReplacing(props.imageElement.id)
	const canRegenerate = Boolean(activeContent.generateImageRequest?.model_id)
	const directGenerateRequest = activeContent.generateImageRequest
	const { activeContentIsGenerating: persistedActiveContentIsGenerating } =
		getContentGenerationState(props.imageElement)
	const runtimeGeneration = useGenerationRuntime(props.imageElement.id, sessionContentId)
	const activeContentIsGenerating =
		persistedActiveContentIsGenerating || Boolean(runtimeGeneration)

	const captureSessionDraft = useCallback(() => {
		if (
			!sessionPersistenceEnabledRef.current ||
			!sessionStore ||
			!sessionIntent ||
			!config.hasRestoredRef.current ||
			config.isRestoringRef.current ||
			config.restoreRevision === 0
		)
			return
		const key = getSessionKey(sessionIntent)
		const snapshot = config.editSession.buildSnapshot()
		const existing = sessionStore.get<ImageEditSessionSnapshot>(key, sessionSourceFingerprint)
		if (existing) {
			sessionStore.updateDraft(key, sessionSourceFingerprint, snapshot)
			setHasInterruptedDraft(!areMediaEditSnapshotsEqual(existing.baseline, snapshot))
			return
		}
		sessionStore.set(key, sessionSourceFingerprint, snapshot, snapshot)
		setHasInterruptedDraft(false)
	}, [
		config.editSession,
		config.hasRestoredRef,
		config.isRestoringRef,
		config.restoreRevision,
		getSessionKey,
		sessionIntent,
		sessionSourceFingerprint,
		sessionStore,
	])

	const captureSessionDraftRef = useLatest(captureSessionDraft)
	useUnmount(() => captureSessionDraftRef.current?.())

	useCanvasEvent(
		"element:deselect",
		({ data }) => {
			if (
				!sessionIntent ||
				(data?.elementIds?.length && !data.elementIds.includes(props.imageElement.id))
			) {
				return
			}
			captureSessionDraft()
		},
		[captureSessionDraft, props.imageElement.id, sessionIntent],
	)

	useEffect(() => {
		if (previousSourceFingerprintRef.current === sessionSourceFingerprint) return
		sessionPersistenceEnabledRef.current = false
		sessionStore?.clearContent(props.imageElement.id, sessionContentId)
		previousSourceFingerprintRef.current = sessionSourceFingerprint
		setSessionIntent(null)
		setHasInterruptedDraft(false)
	}, [props.imageElement.id, sessionContentId, sessionSourceFingerprint, sessionStore])

	const createAndSubmitImageGeneration = useCallback(
		async (
			request: GenerateImageRequest,
			options?: {
				intent?: SecondEditIntent
				closeEditorOnSuccess?: boolean
				clearEditorPromptOnSuccess?: boolean
				deselectOnSuccess?: boolean
			},
		) => {
			if (sendingRef.current) return false
			if (!canvas || !request.prompt?.trim() || !request.model_id) {
				return false
			}
			if (canvas.mediaReplaceController?.isReplacing?.(props.imageElement.id)) {
				return false
			}

			// 获取原图片元素实例
			const originalElementInstance = canvas.elementManager.getElementInstance(
				props.imageElement.id,
			)
			if (
				!originalElementInstance ||
				!(originalElementInstance instanceof ImageElementClass)
			) {
				return false
			}

			const intent = options?.intent ?? "quick-edit"
			const sessionIntentToClear: MediaEditIntent | null =
				intent === "quick-edit" || intent === "re-edit" ? intent : null
			// “再次生成”在当前元素内追加 Content；“重新编辑”恢复旧链路，
			// 以当前元素为来源在右侧创建新的图片元素。
			if (intent === "generate-again") {
				sendingRef.current = true
				setIsSending(true)
				try {
					const result = await props.submissionController.run({
						initialPhase: "submitting",
						execute: async () => {
							const submitted = await originalElementInstance.submitContentGeneration(
								request,
								{
									recoveryIntent: "generate",
								},
							)
							if (submitted) {
								sessionPersistenceEnabledRef.current = false
								if (sessionStore && sessionIntentToClear) {
									sessionStore.clear(getSessionKey(sessionIntentToClear))
									if (sessionIntent === sessionIntentToClear) {
										setHasInterruptedDraft(false)
									}
								}
								canvas.mediaEditRecoveryManager.clearContent(
									props.imageElement.id,
									sessionContentId,
								)
								if (options?.clearEditorPromptOnSuccess) setPrompt("")
								if (options?.closeEditorOnSuccess) setIsEditing(false)
								if (options?.deselectOnSuccess) {
									canvas.selectionManager.deselectAll()
								}
							}
							return { accepted: submitted }
						},
					})
					return result.accepted
				} finally {
					sendingRef.current = false
					setIsSending(false)
				}
			}

			const submissionId = props.submissionController.begin("preparing")
			let accepted = false
			try {
				// 新元素位置间距常量（像素）
				const NEW_ELEMENT_SPACING = 0

				// 计算新元素的位置（放在原元素右边，顶部对齐）
				const newPosition = resolveDerivedRightPlacement(
					props.imageElement,
					originalElementInstance,
					canvas.elementManager,
					{ spacing: NEW_ELEMENT_SPACING },
				)
				if (!newPosition) return false
				const { x: newX, y: newY } = newPosition

				const originalElement = props.imageElement
				let imageInfo = originalElementInstance.getImageInfo()
				if (!imageInfo?.naturalWidth || !imageInfo?.naturalHeight) {
					await originalElementInstance.getHTMLImageElement({ variant: "preview" })
					imageInfo = originalElementInstance.getImageInfo()
				}

				const imageProcessRequestPayload = getImageProcessRequestPayload({
					crop: activeContent.crop,
					sourceDimensions: {
						width: imageInfo?.naturalWidth ?? props.imageElement.width ?? 0,
						height: imageInfo?.naturalHeight ?? props.imageElement.height ?? 0,
					},
				})

				const croppedVisibleWidth =
					originalElement.width ?? activeContent.crop?.displayWidth
				const croppedVisibleHeight =
					originalElement.height ?? activeContent.crop?.displayHeight
				const hasCroppedVisibleSize =
					!!activeContent.crop &&
					Number.isFinite(croppedVisibleWidth) &&
					Number.isFinite(croppedVisibleHeight) &&
					!!croppedVisibleWidth &&
					!!croppedVisibleHeight &&
					croppedVisibleWidth > 0 &&
					croppedVisibleHeight > 0

				// 新元素尺寸优先跟随当前请求配置；没有请求尺寸时再复用裁剪可视尺寸。
				const requestSize = parseImageElementSize(request.size)
				const cropPayloadSize = parseImageElementSize(imageProcessRequestPayload.size)
				let newWidth: number
				let newHeight: number
				if (requestSize) {
					newWidth = requestSize.width
					newHeight = requestSize.height
				} else if (hasCroppedVisibleSize) {
					newWidth = croppedVisibleWidth
					newHeight = croppedVisibleHeight
				} else if (cropPayloadSize) {
					newWidth = cropPayloadSize.width
					newHeight = cropPayloadSize.height
				} else {
					const defaultSize = getDefaultImageSize(imageModelList)
					newWidth = originalElement.width ?? defaultSize?.width ?? 1024
					newHeight = originalElement.height ?? defaultSize?.height ?? 1024
				}

				const newElementId = generateElementId()
				const newZIndex = canvas.elementManager.getNextZIndexInLevel()
				const generateRequest: GenerateImageRequest = {
					...request,
					prompt: request.prompt.trim(),
					size: request.size || imageProcessRequestPayload.size,
				}
				const newImageElement = {
					...ElementFactory.createElementData(
						ElementTypeEnum.Image,
						newElementId,
						newX,
						newY,
						newWidth,
						newHeight,
						newZIndex,
					),
					name: "Image",
				} as ImageElement

				props.submissionController.setPhase(submissionId, "submitting")
				sendingRef.current = true
				setIsSending(true)
				const submitted = await createAndSubmitNewImageGeneration({
					canvas,
					newImageElement,
					request: generateRequest,
					onSubmitStarted: () => {
						canvas.eventEmitter.emit({
							type: "element:image:generate-submit-started",
							data: { elementId: props.imageElement.id },
						})
					},
					onSubmitFailed: () => {
						canvas.eventEmitter.emit({
							type: "element:image:generate-submit-failed",
							data: { elementId: props.imageElement.id },
						})
					},
				})
				if (!submitted) {
					return false
				}
				accepted = true
				sessionPersistenceEnabledRef.current = false
				if (sessionStore && sessionIntentToClear) {
					sessionStore.clear(getSessionKey(sessionIntentToClear))
					if (sessionIntent === sessionIntentToClear) setHasInterruptedDraft(false)
				}
				canvas.mediaEditRecoveryManager.clearContent(
					props.imageElement.id,
					sessionContentId,
				)
				if (options?.clearEditorPromptOnSuccess) {
					setPrompt("")
				}
				if (options?.closeEditorOnSuccess) {
					setIsEditing(false)
				}
				if (options?.deselectOnSuccess) {
					canvas.selectionManager.deselectAll()
				}
				return true
			} finally {
				props.submissionController.finish(submissionId, accepted)
				sendingRef.current = false
				setIsSending(false)
			}
		},
		[
			activeContent.crop,
			canvas,
			getSessionKey,
			imageModelList,
			props.imageElement,
			props.submissionController,
			sessionContentId,
			sessionIntent,
			sessionStore,
			setPrompt,
		],
	)

	// 处理发送按钮点击
	const handleSend = useCallback(
		async (linkedEditorInputs: LinkedEditorInputsState) => {
			const requestParams = handlers.buildRequestParams()
			if (!requestParams.model_id) {
				console.error("[SecondEdit] 无法确定 model_id")
				return
			}
			const generateRequest = buildImageRequestWithLinkedEditorInputs(
				requestParams,
				linkedEditorInputs,
				prompt,
				methods?.resolveResourceReference,
			)
			if (!generateRequest.prompt?.trim()) return

			await createAndSubmitImageGeneration(
				{
					...generateRequest,
					model_id: requestParams.model_id,
				},
				{
					intent: editingIntent,
					clearEditorPromptOnSuccess: true,
					closeEditorOnSuccess: true,
					deselectOnSuccess: true,
				},
			)
		},
		[
			createAndSubmitImageGeneration,
			editingIntent,
			handlers,
			methods?.resolveResourceReference,
			prompt,
		],
	)

	const handleGenerateAgain = useCallback(async () => {
		if (!directGenerateRequest?.model_id || !directGenerateRequest.prompt) return
		await createAndSubmitImageGeneration(directGenerateRequest, { intent: "generate-again" })
	}, [createAndSubmitImageGeneration, directGenerateRequest])

	const openEditor = useCallback(() => {
		if (canvas?.mediaReplaceController?.isReplacing?.(props.imageElement.id)) return
		// 先隐藏
		setIsVisible(false)
		// 设置编辑状态
		setIsEditing(true)
		// 延迟 50ms 后显示并聚焦
		setTimeout(() => {
			if (canvas?.mediaReplaceController?.isReplacing?.(props.imageElement.id)) return
			setIsVisible(true)
		}, 50)
	}, [canvas, props.imageElement.id])

	// 处理进入编辑状态的函数
	const handleStartEditing = useCallback(() => {
		if (canvas?.mediaReplaceController?.isReplacing?.(props.imageElement.id)) return
		if (activeContentIsGenerating) return
		setPendingOpenMode("quick-edit")
	}, [activeContentIsGenerating, canvas, props.imageElement.id])

	/** 按已保存的 generateImageRequest 完整回填后进入编辑态（与快捷编辑仅对齐模型/尺寸不同） */
	const handleRegenerateFromSavedConfig = useCallback(() => {
		if (canvas?.mediaReplaceController?.isReplacing?.(props.imageElement.id)) return
		if (!activeContent.generateImageRequest?.model_id) return
		setPendingOpenMode("regenerate")
	}, [activeContent.generateImageRequest, canvas, props.imageElement.id])

	useEffect(() => {
		const pending = pendingToolCommand
		if (
			!pending ||
			pending.contentId !== sessionContentId ||
			activeContentIsGenerating ||
			isReplacing
		)
			return

		// 消费时使用事件中捕获的 ContentId；即使之后 activeContent 变化，
		// 本次命令也不会被重新路由到其他版本。
		onPendingToolCommandHandled?.()
		switch (pending.toolId) {
			case ElementToolTypeEnum.GenerationQuickEdit:
				handleStartEditing()
				return
			case ElementToolTypeEnum.GenerationReEdit:
				handleRegenerateFromSavedConfig()
				return
			case ElementToolTypeEnum.GenerationGenerateAgain:
				void handleGenerateAgain()
				return
		}
	}, [
		activeContentIsGenerating,
		handleGenerateAgain,
		handleRegenerateFromSavedConfig,
		handleStartEditing,
		isReplacing,
		onPendingToolCommandHandled,
		pendingToolCommand,
		sessionContentId,
	])

	useEffect(() => {
		if (!isReplacing) return
		sessionPersistenceEnabledRef.current = false
		setPendingOpenMode(null)
		setIsEditing(false)
		setIsVisible(false)
		sessionStore?.clearContent(props.imageElement.id, sessionContentId)
		setSessionIntent(null)
		setHasInterruptedDraft(false)
	}, [isReplacing, props.imageElement.id, sessionContentId, sessionStore])

	useEffect(() => {
		if (!pendingOpenMode) return
		// 等模型列表完成后再消费入口指令，避免恢复快照时配置 hook 仍处于未初始化状态。
		if (isLoadingImageModelList) return
		if (isEditing) {
			setPendingOpenMode(null)
			return
		}

		const modeToOpen = pendingOpenMode
		// 先消费指令，避免 restore/open 过程中 effect 重入再次执行。
		setPendingOpenMode(null)
		sessionPersistenceEnabledRef.current = true

		const intent: MediaEditIntent = modeToOpen === "quick-edit" ? "quick-edit" : "re-edit"
		const session = sessionStore?.get<ImageEditSessionSnapshot>(
			getSessionKey(intent),
			sessionSourceFingerprint,
		)
		const hasDraft = Boolean(
			session && !areMediaEditSnapshotsEqual(session.baseline, session.draft),
		)
		setEditingIntent(intent)
		setSessionIntent(intent)
		setHasInterruptedDraft(hasDraft)
		if (session) {
			config.editSession.restoreSnapshotToUi(session.draft)
		} else if (intent === "quick-edit") {
			setPendingBaselineIntent(intent)
			restoreQuickEditConfigToUi()
		} else {
			setPendingBaselineIntent(intent)
			restoreOriginalGenerateImageRequestToUi()
		}
		openEditor()
	}, [
		config.editSession,
		getSessionKey,
		isEditing,
		isLoadingImageModelList,
		openEditor,
		pendingOpenMode,
		restoreOriginalGenerateImageRequestToUi,
		restoreQuickEditConfigToUi,
		sessionSourceFingerprint,
		sessionStore,
	])

	useEffect(() => {
		if (!isEditing || !pendingBaselineIntent || !sessionStore || config.restoreRevision === 0)
			return
		if (!config.hasRestoredRef.current) return
		const key = getSessionKey(pendingBaselineIntent)
		if (!sessionStore.get(key, sessionSourceFingerprint)) {
			const baseline = config.editSession.buildSnapshot()
			sessionStore.set(key, sessionSourceFingerprint, baseline, baseline)
		}
		setPendingBaselineIntent(null)
	}, [
		config.editSession,
		config.hasRestoredRef,
		config.restoreRevision,
		getSessionKey,
		isEditing,
		pendingBaselineIntent,
		sessionSourceFingerprint,
		sessionStore,
	])

	const handleRestoreBaseline = useCallback(() => {
		if (!sessionStore || !sessionIntent) return
		const key = getSessionKey(sessionIntent)
		const session = sessionStore.get<ImageEditSessionSnapshot>(key, sessionSourceFingerprint)
		if (!session) return
		config.editSession.restoreSnapshotToUi(session.baseline)
		sessionStore.set(key, sessionSourceFingerprint, session.baseline, session.baseline)
		setHasInterruptedDraft(false)
		// 恢复配置按钮会抢走焦点；等待编辑器同步快照后，把光标恢复到之前的编辑位置。
		window.setTimeout(() => editorRef.current?.focus(), 0)
	}, [config.editSession, getSessionKey, sessionIntent, sessionSourceFingerprint, sessionStore])

	// 使用 useLatest 获取最新的值，避免闭包问题
	const isEditingRef = useLatest(isEditing)
	const selectedElementsRef = useLatest(selectedElements)
	const handleStartEditingRef = useLatest(handleStartEditing)

	// 监听 Tab 按键
	useEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			if (canvas?.mediaReplaceController?.isReplacing?.(props.imageElement.id)) return
			if (activeContentIsGenerating) return
			// 只在未处于编辑状态时监听
			if (isEditingRef.current) {
				return
			}

			// 检查是否选中了图片元素
			const hasImageSelected = selectedElementsRef.current?.some(
				(element) => element?.type === ElementTypeEnum.Image,
			)
			if (!hasImageSelected) {
				return
			}

			// 交互控件内保留原生 Tab 焦点导航，不触发画布快捷编辑。
			if (isEditorInteractiveKeyboardTarget(e.target)) {
				return
			}

			// 监听 Tab 键
			if (e.key === "Tab" && !e.shiftKey) {
				e.preventDefault()
				handleStartEditingRef.current?.()
			}
		},
		{ target: window },
	)

	useElementToolCommand(
		useMemo(
			() => ({
				elementId: props.imageElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationQuickEdit,
				state: {
					available: !isEditing && !isReplacing,
				},
				execute: handleStartEditing,
			}),
			[handleStartEditing, isEditing, isReplacing, props.imageElement.id, sessionContentId],
		),
	)
	useElementToolCommand(
		useMemo(
			() => ({
				elementId: props.imageElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationReEdit,
				state: {
					available: canRegenerate && !isEditing && !isReplacing,
				},
				execute: handleRegenerateFromSavedConfig,
			}),
			[
				canRegenerate,
				handleRegenerateFromSavedConfig,
				isEditing,
				isReplacing,
				props.imageElement.id,
				sessionContentId,
			],
		),
	)
	useElementToolCommand(
		useMemo(
			() => ({
				elementId: props.imageElement.id,
				contentId: sessionContentId,
				toolId: ElementToolTypeEnum.GenerationGenerateAgain,
				state: {
					available: canRegenerate && !isEditing && !isReplacing,
					disabled: isSending,
					loading: isSending,
				},
				execute: handleGenerateAgain,
			}),
			[
				canRegenerate,
				handleGenerateAgain,
				isEditing,
				isReplacing,
				isSending,
				props.imageElement.id,
				sessionContentId,
			],
		),
	)

	if (isReplacing) return null

	if (isEditing) {
		return (
			<ImageEditorSurface
				imageElement={props.imageElement}
				config={config}
				editorRef={editorRef}
				shouldShow={() =>
					!canvas?.mediaReplaceController?.isReplacing?.(props.imageElement.id) &&
					selectedElements.some((element) => element?.type === ElementTypeEnum.Image)
				}
				floatingId="second-edit"
				selectionPersistenceKey={`image-second-edit:${props.imageElement.id}`}
				placeholder={t("imageEditor.editPlaceholder", "请输入您的编辑需求")}
				onSend={handleSend}
				isSending={isSending}
				autoFocus
				autoFocusAtDocumentEnd
				isDropEnabled={isEditing}
				showRestoreDefaultConfig={hasInterruptedDraft}
				onRestoreDefaultConfig={handleRestoreBaseline}
				className={styles.imageMessageEditor}
				style={{ visibility: isVisible ? "visible" : "hidden" }}
				onPreviewMediaResource={props.onPreviewMediaResource}
				isMediaResourcePreviewOpen={props.isMediaResourcePreviewOpen}
			/>
		)
	}

	return null
}

function parseImageElementSize(size?: string): { width: number; height: number } | null {
	if (!size) return null
	const [width, height] = size.split("x").map(Number)
	if (!Number.isFinite(width) || !Number.isFinite(height)) return null
	if (width <= 0 || height <= 0) return null
	return { width, height }
}
