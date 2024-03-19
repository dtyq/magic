import { useCallback, useState, useRef } from "react"
import { Button } from "../ui/button"
import { ArrowUp } from "../ui/icons/index"
import styles from "./index.module.css"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import type { GenerateImageRequest } from "../../types.magic"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import MessageEditor, { type MessageEditorRef } from "./MessageEditor"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useImageEditorConfig } from "./useImageEditorConfig"
import ImageEditorControls from "./ImageEditorControls"
import { useUpdateEffect } from "ahooks"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { useMessageEditorMention } from "./useMessageEditorMention"
import { useMentionSync } from "./useMentionSync"
import { removeMentionFromString } from "./tiptap/contentUtils"

interface ImageMessageEditorRenderProps {
	imageElement: ImageElement
}

export default function ImageMessageEditorRender(props: ImageMessageEditorRenderProps) {
	const { imageElement } = props

	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const editorRef = useRef<MessageEditorRef>(null)

	// 使用共享的配置 hook
	const config = useImageEditorConfig({
		imageElement,
		protectedReferenceImageIndex: undefined, // 所有参考图都可以删除
		editorFocusRef: editorRef,
	})

	const {
		prompt,
		handlers,
		fileInputRef,
		maxReferenceImages,
		currentReferenceImages,
		isReferenceImageLimitReached,
	} = config

	// 将参考图的 matchableItems 传递给 useMessageEditorMention，用于合并到 @ 面板
	const { matchableItems, mentionDataService, mentionExtension, mentionEnabled } =
		useMessageEditorMention({
			matchableItems: config.matchableItems,
			maxReferenceImages,
			currentReferenceImages,
			isReferenceImageLimitReached,
		})

	const [hasScrollbar, setHasScrollbar] = useState<boolean>(false)

	const { syncMentionPaths } = useMentionSync({
		canvas,
		imageElementId: imageElement.id,
		matchableItems,
		protectedReferenceImageIndex: undefined,
		maxReferenceImages,
		isReferenceImageLimitReached,
		syncFromElement: config.handlers.syncReferenceImagesFromElement,
	})

	const { containerRef } = useElementPositionEffect({
		position: "bottom",
		offset: 12,
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Image)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "image-message-editor",
		enableWheelForwarding: !hasScrollbar,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			containerRef.current = node
			floatingRef.current = node
		},
		[containerRef, floatingRef],
	)

	// 处理上传按钮点击
	const handleUploadClick = useCallback(() => {
		if (config.isReferenceImageLimitReached) {
			return
		}
		handlers.triggerFileSelect()
	}, [config.isReferenceImageLimitReached, handlers])

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
		if (!canvas) {
			return
		}

		if (!config.selectedModelId) {
			return
		}

		if (!prompt.trim()) {
			return
		}

		// 构建请求参数
		const requestParams = handlers.buildRequestParams() as GenerateImageRequest

		// // 获取元素实例
		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (elementInstance && elementInstance instanceof ImageElementClass) {
			// 保存到 tempGenerateImageRequest（发送前确保保存最新数据）
			elementInstance.saveTempGenerateImageRequest(requestParams)
			// 调用元素的 generateImage 方法
			await elementInstance.generateImage(requestParams)
		}
	}, [canvas, config.selectedModelId, prompt, handlers, imageElement.id])

	useUpdateEffect(() => {
		// 如果正在恢复配置，不触发保存
		if (config.isRestoringRef.current) return
		if (!config.hasRestoredRef.current) return
		saveDefaultGenerateImageConfig({
			model_id: config.selectedModelId,
			size: config.selectedSize,
			resolution: config.selectedResolution,
		})
	}, [
		config.selectedModelId,
		config.selectedSize,
		config.selectedResolution,
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

	const handleMentionChange = useCallback(
		(paths: string[], currentPrompt: string) => {
			syncMentionPaths(paths, currentPrompt)
		},
		[syncMentionPaths],
	)

	// Popover 删除时同步到 TipTap：移除 prompt 中的 @ 提及
	const handleReferenceImageRemoveFromPopover = useCallback(
		(path: string) => {
			// 从编辑器获取最新的 prompt，避免闭包问题
			const currentPrompt = editorRef.current?.getCurrentPrompt() ?? prompt
			const fileName =
				config.referenceImageInfos.find((i) => i.path === path)?.fileName ??
				path.split("/").pop()
			handlers.setPrompt(removeMentionFromString(currentPrompt, path, fileName))
			handlers.handleReferenceImageRemove(path)
		},
		[prompt, config.referenceImageInfos, handlers],
	)

	return (
		<div ref={setRefs} className={styles.imageMessageEditor} data-canvas-ui-component>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				multiple
				style={{ display: "none" }}
				onChange={handlers.handleFileChange}
			/>
			<MessageEditor
				ref={editorRef}
				placeholder={t("imageEditor.placeholder", "请输入您的创作需求")}
				value={prompt}
				onChange={(value) => handlers.setPrompt(value)}
				onEnter={handleSend}
				onScrollbarChange={setHasScrollbar}
				matchableItems={matchableItems}
				mentionDataService={mentionDataService}
				mentionExtension={mentionExtension}
				onMentionChange={handleMentionChange}
				mentionEnabled={mentionEnabled}
			/>
			<ImageEditorControls
				config={config}
				protectedReferenceImageIndex={undefined}
				onUploadClick={handleUploadClick}
				onReferenceImageRemove={handleReferenceImageRemoveFromPopover}
				renderSendButton={() => (
					<Button
						className={styles.sendButton}
						onClick={handleSend}
						disabled={!prompt.trim() || !config.selectedModelId}
					>
						<ArrowUp size={16} />
					</Button>
				)}
			/>
		</div>
	)
}
