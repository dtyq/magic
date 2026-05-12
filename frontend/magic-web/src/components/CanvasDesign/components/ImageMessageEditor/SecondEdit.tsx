import { useCallback, useEffect, useState, useRef, type ClipboardEvent } from "react"
import { useEventListener, useLatest } from "ahooks"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { useMagic } from "../../context/MagicContext"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import IconButton from "../ui/custom/IconButton"
import { MediaResultActionBar } from "../canvas-editor/MediaResultActionBar"
import styles from "./index.module.css"
import { Button } from "../ui/button"
import { ArrowUp, LoaderCircle, Pencil, RotateCcw, SquarePen } from "lucide-react"
import MessageEditor, { type MessageEditorRef } from "../MessageEditor/MessageEditor"
import { useMessageEditorMention } from "../MessageEditor/useMessageEditorMention"
import { useMentionSync } from "../MessageEditor/useMentionSync"
import { removeMentionFromString } from "../MessageEditor/tiptap/contentUtils"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import {
	generateElementId,
	calculateNewElementPosition,
	getDefaultImageSize,
} from "../../canvas/utils/utils"
import { getImageProcessRequestPayload } from "../../canvas/utils/imageCropUtils"
import type { GenerateImageRequest } from "../../types.magic"
import { useImageEditorConfig } from "./useImageEditorConfig"
import ImageEditorControls from "./ImageEditorControls"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
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

interface SecondEditProps {
	imageElement: ImageElement
}

export default function SecondEdit(props: SecondEditProps) {
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { imageModelList } = useMagic()
	const { t } = useCanvasDesignI18n()
	const editorRef = useRef<MessageEditorRef>(null)
	const [entryMode, setEntryMode] = useState<"quick-edit" | "regenerate">("quick-edit")
	const [pendingOpenMode, setPendingOpenMode] = useState<"quick-edit" | "regenerate" | null>(null)

	// 使用共享的配置 hook（ossSrc 会直接从实例中获取，因为二次编辑只有在 ossSrc 准备好后才会显示）
	const config = useImageEditorConfig({
		imageElement: props.imageElement,
		protectedReferenceImageIndex: entryMode === "quick-edit" ? 0 : undefined,
		originalImageSrc: props.imageElement.src, // 原图自动作为第一个参考文件
		includeOriginalImageAsReference: entryMode === "quick-edit",
		editorFocusRef: editorRef,
		originalImageName:
			// 从 src 字段提取文件名（例如："/超级画布/images/111.jpg" -> "111.jpg"）
			(props.imageElement.src ? props.imageElement.src.split("/").pop() : undefined) ||
			props.imageElement.name ||
			t("imageEditor.originalImage", "原图"), // 从 src 提取文件名，否则使用 name，最后使用默认值
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
	const {
		restoreQuickEditConfigToUi,
		restoreOriginalGenerateImageRequestToUi,
		uploadFiles,
		setPrompt,
		handleReferenceFileRemove,
		syncReferenceFilesFromElement,
	} = handlers

	// 将参考文件的 matchableItems 传递给 useMessageEditorMention，用于合并到 @ 面板
	const { matchableItems, mentionDataService, mentionExtension, mentionEnabled } =
		useMessageEditorMention({
			matchableItems: config.matchableItems,
			maxReferenceFiles,
			currentReferenceFiles,
			isReferenceFileLimitReached,
			referenceResourceType: config.referenceResourceType,
		})

	const [isEditing, setIsEditing] = useState<boolean>(false)
	const [isVisible, setIsVisible] = useState<boolean>(true)
	const [hasScrollbar, setHasScrollbar] = useState<boolean>(false)
	const [isSending, setIsSending] = useState(false)
	const sendingRef = useRef(false)

	const { syncMentionPaths } = useMentionSync({
		canvas,
		elementId: props.imageElement.id,
		matchableItems,
		protectedReferenceFileIndex: entryMode === "quick-edit" ? 0 : undefined,
		maxReferenceFiles,
		isReferenceFileLimitReached,
		syncFromElement: syncReferenceFilesFromElement,
	})
	const canRegenerate = Boolean(props.imageElement.generateImageRequest?.model_id)
	const directGenerateRequest = props.imageElement.generateImageRequest

	const { containerRef: positionRef } = useElementPositionEffect({
		position: "bottom",
		offset: 12,
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Image)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "second-edit",
		enableWheelForwarding: !hasScrollbar, // 编辑状态下或出现滚动条时不转发 wheel 事件
	})

	// 合并 refs
	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	const createAndSubmitImageGeneration = useCallback(
		async (
			request: GenerateImageRequest,
			options?: {
				closeEditorOnSuccess?: boolean
				clearEditorPromptOnSuccess?: boolean
				deselectOnSuccess?: boolean
			},
		) => {
			if (sendingRef.current) return false
			if (!canvas || !request.prompt?.trim() || !request.model_id) {
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

			// 新元素位置间距常量（像素）
			const NEW_ELEMENT_SPACING = 0

			// 计算新元素的位置（放在原元素右边，顶部对齐）
			const newPosition = calculateNewElementPosition(
				props.imageElement,
				originalElementInstance,
				canvas.elementManager,
				NEW_ELEMENT_SPACING,
			)
			if (!newPosition) {
				return false
			}
			const { x: newX, y: newY } = newPosition

			const originalElement = props.imageElement
			const croppedVisibleWidth = originalElement.width ?? originalElement.crop?.displayWidth
			const croppedVisibleHeight =
				originalElement.height ?? originalElement.crop?.displayHeight
			const hasCroppedVisibleSize =
				!!originalElement.crop &&
				Number.isFinite(croppedVisibleWidth) &&
				Number.isFinite(croppedVisibleHeight) &&
				!!croppedVisibleWidth &&
				!!croppedVisibleHeight &&
				croppedVisibleWidth > 0 &&
				croppedVisibleHeight > 0

			// 获取新图片的尺寸：已裁剪图片二次编辑时优先复用当前可视尺寸
			let newWidth: number
			let newHeight: number
			if (hasCroppedVisibleSize) {
				newWidth = croppedVisibleWidth
				newHeight = croppedVisibleHeight
			} else if (request.size) {
				const [w, h] = request.size.split("x").map(Number)
				if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
					newWidth = w
					newHeight = h
				} else {
					const defaultSize = getDefaultImageSize(imageModelList)
					newWidth = originalElement.width ?? defaultSize?.width ?? 1024
					newHeight = originalElement.height ?? defaultSize?.height ?? 1024
				}
			} else {
				const defaultSize = getDefaultImageSize(imageModelList)
				newWidth = originalElement.width ?? defaultSize?.width ?? 1024
				newHeight = originalElement.height ?? defaultSize?.height ?? 1024
			}

			// 生成新元素 ID
			const newElementId = generateElementId()

			// 获取下一个 zIndex
			const newZIndex = canvas.elementManager.getNextZIndexInLevel()

			let imageInfo = originalElementInstance.getImageInfo()
			if (!imageInfo?.naturalWidth || !imageInfo?.naturalHeight) {
				await originalElementInstance.getHTMLImageElement()
				imageInfo = originalElementInstance.getImageInfo()
			}

			const imageProcessRequestPayload = getImageProcessRequestPayload({
				crop: props.imageElement.crop,
				sourceDimensions: {
					width: imageInfo?.naturalWidth ?? props.imageElement.width ?? 0,
					height: imageInfo?.naturalHeight ?? props.imageElement.height ?? 0,
				},
			})

			const generateRequest: GenerateImageRequest = {
				...request,
				prompt: request.prompt.trim(),
				size: request.size || imageProcessRequestPayload.size,
			}

			// 创建新的图片元素数据（使用选中的尺寸）
			const newImageElement: ImageElement = {
				id: newElementId,
				type: ElementTypeEnum.Image,
				x: newX,
				y: newY,
				width: newWidth,
				height: newHeight,
				zIndex: newZIndex,
				name: "Image",
			}

			// 创建元素
			canvas.elementManager.create(newImageElement)

			// 获取新创建的元素实例
			const newElementInstance = canvas.elementManager.getElementInstance(newElementId)
			if (!newElementInstance || !(newElementInstance instanceof ImageElementClass)) {
				return false
			}

			// 保存新元素的临时配置（清除 prompt / reference_images / reference_image_options）
			newElementInstance.saveTempGenerateImageRequest({
				...generateRequest,
				prompt: "",
				reference_images: [],
				reference_image_options: undefined,
			})

			sendingRef.current = true
			setIsSending(true)
			try {
				canvas.eventEmitter.emit({
					type: "element:image:generate-submit-started",
					data: { elementId: props.imageElement.id },
				})
				const submitted = await newElementInstance.generateImage(generateRequest)
				if (!submitted) {
					canvas.eventEmitter.emit({
						type: "element:image:generate-submit-failed",
						data: { elementId: props.imageElement.id },
					})
					return false
				}
				originalElementInstance.clearTempGenerateImageRequestPrompt()
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
			} catch (error) {
				canvas.eventEmitter.emit({
					type: "element:image:generate-submit-failed",
					data: { elementId: props.imageElement.id },
				})
				return false
			} finally {
				sendingRef.current = false
				setIsSending(false)
			}
		},
		[canvas, imageModelList, props.imageElement, setPrompt],
	)

	// 处理发送按钮点击
	const handleSend = useCallback(async () => {
		const requestParams = handlers.buildRequestParams()
		if (!requestParams.model_id) {
			console.error("[SecondEdit] 无法确定 model_id")
			return
		}
		await createAndSubmitImageGeneration(
			{
				model_id: requestParams.model_id,
				prompt: requestParams.prompt || prompt.trim(),
				size: requestParams.size,
				resolution: requestParams.resolution,
				reference_images: requestParams.reference_images,
				reference_image_options: requestParams.reference_image_options,
				image_generation_config: requestParams.image_generation_config,
			},
			{
				clearEditorPromptOnSuccess: true,
				closeEditorOnSuccess: true,
				deselectOnSuccess: true,
			},
		)
	}, [createAndSubmitImageGeneration, handlers, prompt])

	const handleGenerateAgain = useCallback(async () => {
		if (!directGenerateRequest?.model_id || !directGenerateRequest.prompt) return
		await createAndSubmitImageGeneration(directGenerateRequest)
	}, [createAndSubmitImageGeneration, directGenerateRequest])

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
			void uploadFiles(files)
		},
		[canAcceptLocalFiles, uploadFiles],
	)

	const { overlayState, dragEvents } = useReferenceResourceDrop({
		isEnabled: isEditing,
		checkProjectFiles: canAcceptProjectFiles,
		checkLocalFiles: canAcceptLocalFiles,
		getProjectHoverState: getHoverDropState,
		getLocalHoverState,
		onDropProjectFiles: handleProjectFilesDrop,
		onDropLocalFiles: uploadFiles,
	})

	const openEditor = useCallback(() => {
		// 先隐藏
		setIsVisible(false)
		// 设置编辑状态
		setIsEditing(true)
		// 延迟 50ms 后显示并聚焦
		setTimeout(() => {
			setIsVisible(true)
		}, 50)
	}, [])

	// 处理进入编辑状态的函数
	const handleStartEditing = useCallback(() => {
		setEntryMode("quick-edit")
		setPendingOpenMode("quick-edit")
	}, [])

	/** 按已保存的 generateImageRequest 完整回填后进入编辑态（与快捷编辑仅对齐模型/尺寸不同） */
	const handleRegenerateFromSavedConfig = useCallback(() => {
		if (!props.imageElement.generateImageRequest?.model_id) return
		setEntryMode("regenerate")
		setPendingOpenMode("regenerate")
	}, [props.imageElement.generateImageRequest])

	useEffect(() => {
		if (!pendingOpenMode) return
		if (isEditing) {
			setPendingOpenMode(null)
			return
		}

		const modeToOpen = pendingOpenMode
		// 先消费指令，避免 restore/open 过程中 effect 重入再次执行。
		setPendingOpenMode(null)

		if (modeToOpen === "quick-edit") {
			restoreQuickEditConfigToUi()
		} else {
			restoreOriginalGenerateImageRequestToUi()
		}
		openEditor()
	}, [
		isEditing,
		openEditor,
		pendingOpenMode,
		restoreOriginalGenerateImageRequestToUi,
		restoreQuickEditConfigToUi,
	])

	// 使用 useLatest 获取最新的值，避免闭包问题
	const isEditingRef = useLatest(isEditing)
	const selectedElementsRef = useLatest(selectedElements)
	const handleStartEditingRef = useLatest(handleStartEditing)

	// 监听 Tab 按键
	useEventListener(
		"keydown",
		(e: KeyboardEvent) => {
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

			// 如果用户在输入框中，不处理 Tab 键
			const target = e.target as HTMLElement
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			) {
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
			setPrompt(removeMentionFromString(currentPrompt, path, fileName))
			handleReferenceFileRemove(path)
		},
		[prompt, config.referenceFileInfos, handleReferenceFileRemove, setPrompt],
	)

	if (isEditing) {
		return (
			<ReferenceResourceDropSurface
				ref={setRefs}
				className={styles.imageMessageEditor}
				data-canvas-ui-component
				style={{ visibility: isVisible ? "visible" : "hidden" }}
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
					autoFocus
					fullWidth
					selectionPersistenceKey={`image-second-edit:${props.imageElement.id}`}
					placeholder={t("imageEditor.editPlaceholder", "请输入您的编辑需求")}
					value={prompt}
					onChange={handlers.setPrompt}
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
					protectedReferenceFileIndex={entryMode === "quick-edit" ? 0 : undefined}
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

	return (
		<div
			ref={setRefs}
			className={`${styles.imageMessageEditor} ${styles.secondEditImageMessageEditorNoEditing}`}
			data-canvas-ui-component
			style={{ visibility: isVisible ? "visible" : "hidden" }}
		>
			<MediaResultActionBar
				showDividers
				dividerBeforeIndices={canRegenerate ? [1] : []}
				actions={[
					<IconButton
						className={styles.secondEditButton}
						onClick={handleStartEditing}
						key="quick-edit"
					>
						<Pencil size={14} />
						<span>{t("imageEditor.quickEdit", "快捷编辑")}</span>
						<span className={styles.secondEditButtonTag}>Tab</span>
					</IconButton>,
					canRegenerate ? (
						<IconButton
							className={styles.secondEditButton}
							onClick={handleRegenerateFromSavedConfig}
							key="re-edit"
						>
							<SquarePen size={14} />
							<span>{t("imageEditor.reEditFromSaved", "重新编辑")}</span>
						</IconButton>
					) : null,
					canRegenerate ? (
						<IconButton
							className={styles.secondEditButton}
							onClick={handleGenerateAgain}
							key="generate-again"
						>
							{isSending ? (
								<LoaderCircle size={14} className="animate-spin" />
							) : (
								<RotateCcw size={14} />
							)}
							<span>{t("imageEditor.generateAgain", "再次生成")}</span>
						</IconButton>
					) : null,
				]}
			/>
		</div>
	)
}
