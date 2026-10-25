import { useCallback, useRef, useState } from "react"
import { ElementTypeEnum, type ImageElement } from "../../../../runtime/document/types"
import { useCanvasSelectionUI } from "../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import type { GenerateImageRequest } from "../../../../public/magic-types"
import { ImageElement as ImageElementClass } from "../../../../runtime/elements/image/ImageElement"
import { type MessageEditorRef } from "../../../editors/message/MessageEditor"
import { useCanvasDesignI18n } from "../../../../app/providers/I18nProvider"
import { useImageEditorConfig } from "./useImageEditorConfig"
import { useUpdateEffect } from "ahooks"
import ImageEditorSurface from "./ImageEditorSurface"
import type { MediaResourceFullscreenPreviewItem } from "../../../fullscreen/media-resource/index"
import type { LinkedEditorInputsState } from "../../../editors/connection/useLinkedEditorInputs"
import { buildImageRequestWithLinkedEditorInputs } from "../../../editors/connection/linkedImageRequest"
import { isImageElementContent } from "../../../../runtime/document/elementContent"
import type { MediaEditorSubmissionController } from "../shared/useMediaEditorSubmission"

interface ImageMessageEditorRenderProps {
	readOnly?: boolean
	request?: GenerateImageRequest
	imageElement: ImageElement
	autoFocus?: boolean
	/** 与 autoFocus 联用：挂载后将光标置于提示词末尾 */
	autoFocusAtDocumentEnd?: boolean
	onPreviewMediaResource?: (resource: MediaResourceFullscreenPreviewItem) => void
	isMediaResourcePreviewOpen?: boolean
	submissionController: MediaEditorSubmissionController
}

export default function ImageMessageEditorRender(props: ImageMessageEditorRenderProps) {
	const {
		imageElement,
		readOnly = false,
		request,
		autoFocus = false,
		autoFocusAtDocumentEnd = false,
		onPreviewMediaResource,
		isMediaResourcePreviewOpen = false,
		submissionController,
	} = props
	const runSubmission = submissionController.run

	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasSelectionUI()
	const { canvas } = useCanvas()
	const editorRef = useRef<MessageEditorRef>(null)
	const [isSending, setIsSending] = useState(false)
	const sendingRef = useRef(false)

	// 使用共享的配置 hook
	const config = useImageEditorConfig({
		readOnly,
		request,
		manageRecoverySession: !readOnly,
		imageElement,
		editorFocusRef: editorRef,
	})
	// 保存默认生图配置
	const saveDefaultGenerateImageConfig = useCallback(
		(requestParams: GenerateImageRequest) => {
			if (!canvas) {
				return
			}
			// 保存配置到 rootStorage.defaultGenerateImageConfig（每次都覆盖）
			const methods = canvas.magicConfigManager.config?.methods
			if (methods?.getRootStorage && methods?.saveRootStorage) {
				const rootStorage = methods.getRootStorage() || {}
				const defaultConfig = {
					model_id: requestParams.model_id,
					size: requestParams.size,
					resolution: requestParams.resolution,
					image_generation_config: requestParams.image_generation_config,
				}
				methods.saveRootStorage({
					...rootStorage,
					defaultGenerateImageConfig: defaultConfig,
				})
			}
		},
		[canvas],
	)

	// 处理发送按钮点击
	const handleSend = useCallback(
		async (linkedEditorInputs: LinkedEditorInputsState) => {
			if (readOnly || !canvas?.permissionManager.can("sideEffect.generate")) return
			if (sendingRef.current) return
			if (!canvas) {
				return
			}

			if (!config.selectedModelId) {
				return
			}

			// 构建请求参数
			const requestParams = config.handlers.buildRequestParams() as GenerateImageRequest
			const generateRequest = buildImageRequestWithLinkedEditorInputs(
				requestParams,
				linkedEditorInputs,
				config.prompt,
				canvas.magicConfigManager.config?.methods?.resolveResourceReference,
			)
			if (!generateRequest.prompt?.trim()) {
				return
			}

			const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
			if (!elementInstance || !(elementInstance instanceof ImageElementClass)) {
				return
			}

			sendingRef.current = true
			setIsSending(true)
			try {
				config.handlers.cancelPendingDraftPersistence()
				config.handlers.saveDraftRequest(requestParams)
				await runSubmission({
					initialPhase: "submitting",
					execute: async () => {
						const activeContent = elementInstance.getActiveContentData()
						const submitted =
							isImageElementContent(elementInstance.getData()) &&
							activeContent.status === "failed"
								? await elementInstance.submitContentGeneration(generateRequest)
								: await elementInstance.submitGeneration(generateRequest)
						return { accepted: submitted }
					},
				})
			} finally {
				sendingRef.current = false
				setIsSending(false)
			}
		},
		[
			canvas,
			config.handlers,
			config.prompt,
			config.selectedModelId,
			imageElement.id,
			readOnly,
			runSubmission,
		],
	)

	useUpdateEffect(() => {
		if (readOnly) return
		// 如果正在恢复配置，不触发保存
		if (config.isRestoringRef.current) return
		if (!config.hasRestoredRef.current) return
		saveDefaultGenerateImageConfig({
			model_id: config.selectedModelId,
			size: config.selectedSize,
			resolution: config.selectedResolution,
			image_generation_config: config.selectedImageGenerationConfig,
		})
	}, [
		config.selectedModelId,
		config.selectedSize,
		config.selectedResolution,
		config.selectedImageGenerationConfig,
		config.isRestoringRef,
		config.hasRestoredRef,
		saveDefaultGenerateImageConfig,
	])

	useUpdateEffect(() => {
		if (readOnly) return
		if (!canvas || !config.hasRestoredRef.current) return
		const [width, height] = config.selectedSize?.split("x").map(Number) || []
		if (!isNaN(width) && !isNaN(height)) {
			canvas.toolManager.getImageGeneratorTool().setDefaultSize({ width, height })
		}
	}, [config.selectedSize])

	return (
		<ImageEditorSurface
			readOnly={readOnly}
			imageElement={imageElement}
			config={config}
			editorRef={editorRef}
			shouldShow={() =>
				selectedElements.some((element) => element?.type === ElementTypeEnum.Image)
			}
			floatingId="image-message-editor"
			selectionPersistenceKey={`image-generate:${imageElement.id}`}
			placeholder={t("imageEditor.placeholder", "请输入您的创作需求")}
			onSend={handleSend}
			isSending={isSending}
			autoFocus={autoFocus}
			autoFocusAtDocumentEnd={autoFocusAtDocumentEnd}
			onPreviewMediaResource={onPreviewMediaResource}
			isMediaResourcePreviewOpen={isMediaResourcePreviewOpen}
		/>
	)
}
