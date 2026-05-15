import { useCallback, useRef, useState } from "react"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import { useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import type { GenerateImageRequest } from "../../types.magic"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { type MessageEditorRef } from "../MessageEditor/MessageEditor"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useImageEditorConfig } from "./useImageEditorConfig"
import { useUpdateEffect } from "ahooks"
import ImageEditorSurface from "./ImageEditorSurface"

interface ImageMessageEditorRenderProps {
	imageElement: ImageElement
	autoFocus?: boolean
	/** 与 autoFocus 联用：挂载后将光标置于提示词末尾 */
	autoFocusAtDocumentEnd?: boolean
}

export default function ImageMessageEditorRender(props: ImageMessageEditorRenderProps) {
	const { imageElement, autoFocus = false, autoFocusAtDocumentEnd = false } = props

	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasSelectionUI()
	const { canvas } = useCanvas()
	const editorRef = useRef<MessageEditorRef>(null)
	const [isSending, setIsSending] = useState(false)
	const sendingRef = useRef(false)

	// 使用共享的配置 hook
	const config = useImageEditorConfig({
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
	const handleSend = useCallback(async () => {
		if (sendingRef.current) return
		if (!canvas) {
			return
		}

		if (!config.selectedModelId) {
			return
		}

		if (!config.prompt.trim()) {
			return
		}

		// 构建请求参数
		const requestParams = config.handlers.buildRequestParams() as GenerateImageRequest

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!elementInstance || !(elementInstance instanceof ImageElementClass)) {
			return
		}

		sendingRef.current = true
		setIsSending(true)
		try {
			config.handlers.cancelPendingDraftPersistence()
			config.handlers.saveDraftRequest(requestParams)
			await elementInstance.generateImage(requestParams)
		} finally {
			sendingRef.current = false
			setIsSending(false)
		}
	}, [canvas, config.handlers, config.prompt, config.selectedModelId, imageElement.id])

	useUpdateEffect(() => {
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
		if (!canvas || !config.hasRestoredRef.current) return
		const [width, height] = config.selectedSize?.split("x").map(Number) || []
		if (!isNaN(width) && !isNaN(height)) {
			canvas.toolManager.getImageGeneratorTool().setDefaultSize({ width, height })
		}
	}, [config.selectedSize])

	return (
		<ImageEditorSurface
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
		/>
	)
}
