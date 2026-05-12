import { useCallback, useState, useRef, type ClipboardEvent } from "react"
import { Button } from "../ui/button"
import { ArrowUp, LoaderCircle } from "lucide-react"
import styles from "./index.module.css"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import type { GenerateImageRequest } from "../../types.magic"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import MessageEditor, { type MessageEditorRef } from "../MessageEditor/MessageEditor"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useImageEditorConfig } from "./useImageEditorConfig"
import ImageEditorControls from "./ImageEditorControls"
import { useUpdateEffect } from "ahooks"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { useMessageEditorMention } from "../MessageEditor/useMessageEditorMention"
import { useMentionSync } from "../MessageEditor/useMentionSync"
import { removeMentionFromString } from "../MessageEditor/tiptap/contentUtils"
import type { ReferenceResourceSourceType } from "../MessageEditor/reference-assets/reference-resource.types"
import type { ReferenceResourcePanelItem } from "../../types"
import { ReferenceResourceDropSurface } from "../MessageEditor/reference-assets/ReferenceResourceDropSurface"
import { createReferenceResourcePanelItemFromDropFile } from "../MessageEditor/reference-assets/createReferenceResourcePanelItem"
import {
	checkLocalReferenceResourceDrop,
	checkProjectReferenceResourceDrop,
	getReferenceResourceHoverState,
	getReferenceResourceLocalHoverState,
	normalizeProjectDropFiles,
	type ReferenceDropProjectFile,
	useReferenceResourceDrop,
} from "../MessageEditor/reference-assets/useReferenceResourcePanelDataService"

interface ImageMessageEditorRenderProps {
	imageElement: ImageElement
	autoFocus?: boolean
}

export default function ImageMessageEditorRender(props: ImageMessageEditorRenderProps) {
	const { imageElement, autoFocus = false } = props

	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasSelectionUI()
	const { canvas } = useCanvas()
	const editorRef = useRef<MessageEditorRef>(null)
	const [isSending, setIsSending] = useState(false)
	const sendingRef = useRef(false)

	// 使用共享的配置 hook
	const config = useImageEditorConfig({
		imageElement,
		protectedReferenceImageIndex: undefined, // 所有参考文件都可以删除
		editorFocusRef: editorRef,
	})

	const {
		prompt,
		handlers,
		fileInputRef,
		fileInputAccept,
		maxReferenceFiles,
		currentReferenceFiles,
		isReferenceFileLimitReached,
	} = config

	// 将参考文件的 matchableItems 传递给 useMessageEditorMention，用于合并到 @ 面板
	const { matchableItems, mentionDataService, mentionExtension, mentionEnabled } =
		useMessageEditorMention({
			matchableItems: config.matchableItems,
			maxReferenceFiles,
			currentReferenceFiles,
			isReferenceFileLimitReached,
			referenceResourceType: config.referenceResourceType,
		})

	const [hasScrollbar, setHasScrollbar] = useState<boolean>(false)

	const { syncMentionPaths } = useMentionSync({
		canvas,
		elementId: imageElement.id,
		matchableItems,
		protectedReferenceFileIndex: undefined,
		maxReferenceFiles,
		isReferenceFileLimitReached,
		syncFromElement: config.handlers.syncReferenceFilesFromElement,
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

	const handleSelectSource = useCallback(
		(source: ReferenceResourceSourceType) => {
			handlers.setPopoverOpen(false)
			if (source === "local-upload") {
				if (config.isReferenceFileLimitReached) {
					return
				}
				handlers.triggerFileSelect()
			}
		},
		[config.isReferenceFileLimitReached, handlers],
	)

	const handleProjectSelect = useCallback((item: ReferenceResourcePanelItem) => {
		editorRef.current?.insertMentionItems([item])
	}, [])

	const canAcceptReferenceDrop =
		!config.isUploading && Boolean(maxReferenceFiles && maxReferenceFiles > 0)

	const canAcceptProjectFiles = useCallback(
		(files: ReferenceDropProjectFile[]) => {
			return checkProjectReferenceResourceDrop({
				isDropEnabled: canAcceptReferenceDrop,
				files,
				matchableItems,
				currentReferenceFiles,
				maxReferenceFiles,
			})
		},
		[canAcceptReferenceDrop, matchableItems, currentReferenceFiles, maxReferenceFiles],
	)

	const canAcceptLocalFiles = useCallback(
		(files: File[]) => {
			return checkLocalReferenceResourceDrop({
				isDropEnabled: canAcceptReferenceDrop,
				files,
				accept: fileInputAccept,
				currentReferenceFileCount: currentReferenceFiles.length,
				maxReferenceFiles,
			})
		},
		[canAcceptReferenceDrop, fileInputAccept, maxReferenceFiles, currentReferenceFiles],
	)

	const getHoverDropState = useCallback(
		() =>
			getReferenceResourceHoverState({
				isDropEnabled: canAcceptReferenceDrop,
				currentReferenceFileCount: currentReferenceFiles.length,
				maxReferenceFiles,
			}),
		[canAcceptReferenceDrop, maxReferenceFiles, currentReferenceFiles],
	)

	const getLocalHoverState = useCallback(
		(dataTransfer: DataTransfer | null) =>
			getReferenceResourceLocalHoverState({
				isDropEnabled: canAcceptReferenceDrop,
				dataTransfer,
				accept: fileInputAccept,
				currentReferenceFileCount: currentReferenceFiles.length,
				maxReferenceFiles,
			}),
		[canAcceptReferenceDrop, fileInputAccept, maxReferenceFiles, currentReferenceFiles],
	)

	const handleProjectFilesDrop = useCallback(
		(files: ReferenceDropProjectFile[]) => {
			const normalizedFiles = normalizeProjectDropFiles(
				files,
				matchableItems,
				currentReferenceFiles,
			)
			editorRef.current?.insertMentionItems(
				normalizedFiles.map((file) => createReferenceResourcePanelItemFromDropFile(file)),
			)
		},
		[currentReferenceFiles, matchableItems],
	)

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLDivElement>) => {
			const files = Array.from(event.clipboardData.files)
			if (files.length === 0) return
			if (!canAcceptLocalFiles(files).accepted) return

			event.preventDefault()
			void handlers.uploadFiles(files)
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
		onDropLocalFiles: handlers.uploadFiles,
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

		if (!prompt.trim()) {
			return
		}

		// 构建请求参数
		const requestParams = handlers.buildRequestParams() as GenerateImageRequest

		const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
		if (!elementInstance || !(elementInstance instanceof ImageElementClass)) {
			return
		}

		sendingRef.current = true
		setIsSending(true)
		try {
			handlers.cancelPendingDraftPersistence()
			handlers.saveDraftRequest(requestParams)
			await elementInstance.generateImage(requestParams)
		} finally {
			sendingRef.current = false
			setIsSending(false)
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

	const handleMentionChange = useCallback(
		(paths: string[], currentPrompt: string) => {
			syncMentionPaths(paths, currentPrompt)
		},
		[syncMentionPaths],
	)

	// Popover 删除时同步到 TipTap：移除 prompt 中的 @ 提及
	const handleReferenceFileRemoveFromPopover = useCallback(
		(path: string) => {
			// 从编辑器获取最新的 prompt，避免闭包问题
			const currentPrompt = editorRef.current?.getCurrentPrompt() ?? prompt
			const fileName =
				config.referenceFileInfos.find((i) => i.path === path)?.fileName ??
				path.split("/").pop()
			handlers.setPrompt(removeMentionFromString(currentPrompt, path, fileName))
			handlers.handleReferenceFileRemove(path)
		},
		[prompt, config.referenceFileInfos, handlers],
	)

	return (
		<ReferenceResourceDropSurface
			ref={setRefs}
			className={styles.imageMessageEditor}
			data-canvas-ui-component
			dropOverlayState={overlayState}
			dragEvents={dragEvents}
		>
			<input
				ref={fileInputRef}
				type="file"
				accept={fileInputAccept}
				multiple
				style={{ display: "none" }}
				onChange={handlers.handleFileChange}
			/>
			<MessageEditor
				ref={editorRef}
				autoFocus={autoFocus}
				fullWidth
				selectionPersistenceKey={`image-generate:${imageElement.id}`}
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
				onPaste={handlePaste}
			/>
			<ImageEditorControls
				config={config}
				protectedReferenceFileIndex={undefined}
				onSelectSource={handleSelectSource}
				onProjectSelect={handleProjectSelect}
				onReferenceFileRemove={handleReferenceFileRemoveFromPopover}
				renderSendButton={() => (
					<Button
						className={styles.sendButton}
						onClick={handleSend}
						disabled={isSending || !prompt.trim() || !config.selectedModelId}
						aria-busy={isSending}
					>
						{isSending ? (
							<LoaderCircle size={16} className="animate-spin" />
						) : (
							<ArrowUp size={16} />
						)}
					</Button>
				)}
			/>
		</ReferenceResourceDropSurface>
	)
}
