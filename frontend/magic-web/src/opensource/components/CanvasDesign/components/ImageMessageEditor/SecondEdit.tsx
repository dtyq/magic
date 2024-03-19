import { useCallback, useState, useRef } from "react"
import { useEventListener, useLatest } from "ahooks"
import { ElementTypeEnum, type ImageElement } from "../../canvas/types"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { useMagic } from "../../context/MagicContext"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import IconButton from "../ui/custom/IconButton"
import styles from "./index.module.css"
import { Button } from "../ui/button"
import { ArrowUp } from "../ui/icons"
import MessageEditor, { type MessageEditorRef } from "./MessageEditor"
import { useMessageEditorMention } from "./useMessageEditorMention"
import { useMentionSync } from "./useMentionSync"
import { removeMentionFromString } from "./tiptap/contentUtils"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import {
	generateElementId,
	calculateNewElementPosition,
	getDefaultImageSize,
} from "../../canvas/utils/utils"
import type { GenerateImageRequest } from "../../types.magic"
import { useImageEditorConfig } from "./useImageEditorConfig"
import ImageEditorControls from "./ImageEditorControls"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"

interface SecondEditProps {
	imageElement: ImageElement
}

export default function SecondEdit(props: SecondEditProps) {
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { imageModelList } = useMagic()
	const { t } = useCanvasDesignI18n()
	const editorRef = useRef<MessageEditorRef>(null)

	// 使用共享的配置 hook（ossSrc 会直接从实例中获取，因为二次编辑只有在 ossSrc 准备好后才会显示）
	const config = useImageEditorConfig({
		imageElement: props.imageElement,
		protectedReferenceImageIndex: 0, // 第一个参考图（原图）不能删除
		originalImageSrc: props.imageElement.src, // 原图自动作为第一个参考图
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
		selectedSize,
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

	const [isEditing, setIsEditing] = useState<boolean>(false)
	const [isVisible, setIsVisible] = useState<boolean>(true)
	const [hasScrollbar, setHasScrollbar] = useState<boolean>(false)

	const { syncMentionPaths } = useMentionSync({
		canvas,
		imageElementId: props.imageElement.id,
		matchableItems,
		protectedReferenceImageIndex: 0,
		maxReferenceImages,
		isReferenceImageLimitReached,
		syncFromElement: config.handlers.syncReferenceImagesFromElement,
	})

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

	// 处理发送按钮点击
	const handleSend = useCallback(async () => {
		if (!canvas || !prompt.trim()) {
			return
		}

		// 验证原图片是否有 src
		const originalSrc = props.imageElement.src
		if (!originalSrc) {
			return
		}

		// 获取原图片元素实例
		const originalElementInstance = canvas.elementManager.getElementInstance(
			props.imageElement.id,
		)
		if (!originalElementInstance || !(originalElementInstance instanceof ImageElementClass)) {
			return
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
			return
		}
		const { x: newX, y: newY } = newPosition

		// 获取新图片的尺寸（优先使用选中的尺寸，否则使用原图的尺寸）
		let newWidth: number
		let newHeight: number
		if (selectedSize) {
			// 解析选中的尺寸（格式： "1024x1024"）
			const [w, h] = selectedSize.split("x").map(Number)
			if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
				newWidth = w
				newHeight = h
			} else {
				// 如果解析失败，使用原图尺寸
				const originalElement = props.imageElement
				const defaultSize = getDefaultImageSize(imageModelList)
				newWidth = originalElement.width ?? defaultSize?.width ?? 1024
				newHeight = originalElement.height ?? defaultSize?.height ?? 1024
			}
		} else {
			// 如果没有选中尺寸，使用原图尺寸
			const originalElement = props.imageElement
			const defaultSize = getDefaultImageSize(imageModelList)
			newWidth = originalElement.width ?? defaultSize?.width ?? 1024
			newHeight = originalElement.height ?? defaultSize?.height ?? 1024
		}

		// 生成新元素 ID
		const newElementId = generateElementId()

		// 获取下一个 zIndex
		const newZIndex = canvas.elementManager.getNextZIndexInLevel()

		// 使用 hook 返回的配置构建请求参数
		const requestParams = handlers.buildRequestParams()

		// 确保有 model_id
		if (!requestParams.model_id) {
			console.error("[SecondEdit] 无法确定 model_id")
			return
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
			return
		}

		// 构建生图请求参数（使用 hook 返回的配置）
		// reference_images 应该已经包含了原图（通过 ensureOriginalImageFirst 确保原图在第一个位置）
		const generateRequest: GenerateImageRequest = {
			model_id: requestParams.model_id,
			prompt: requestParams.prompt || prompt.trim(),
			size: requestParams.size,
			resolution: requestParams.resolution,
			reference_images: requestParams.reference_images, // 原图已经在列表中（第一个位置，且不能删除）
		}

		// 保存新元素的临时配置（清除 prompt 和 reference_images）
		newElementInstance.saveTempGenerateImageRequest({
			...generateRequest,
			prompt: "",
			reference_images: [],
		})

		// 发起生图请求
		try {
			await newElementInstance.generateImage(generateRequest)
			// 清除原元素的临时配置中的 prompt（保留其他配置，以便二次编辑时复用）
			originalElementInstance.clearTempGenerateImageRequestPrompt()
			// 清空输入框并退出编辑状态
			handlers.setPrompt("")
			setIsEditing(false)

			// 清空画布选中状态
			canvas.selectionManager.deselectAll()
		} catch (error) {
			//
		}
	}, [canvas, props.imageElement, prompt, imageModelList, handlers, selectedSize])

	// 处理上传按钮点击
	const handleUploadClick = useCallback(() => {
		if (config.isReferenceImageLimitReached) {
			return
		}
		handlers.triggerFileSelect()
	}, [config.isReferenceImageLimitReached, handlers])

	// 处理进入编辑状态的函数
	const handleStartEditing = useCallback(() => {
		// 先隐藏
		setIsVisible(false)
		// 设置编辑状态
		setIsEditing(true)
		// 延迟 50ms 后显示并聚焦
		setTimeout(() => {
			setIsVisible(true)
		}, 50)
	}, [])

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
		<div
			ref={setRefs}
			className={`${styles.imageMessageEditor} ${
				!isEditing ? styles.secondEditImageMessageEditorNoEditing : ""
			}`}
			data-canvas-ui-component
			style={{ visibility: isVisible ? "visible" : "hidden" }}
		>
			{isEditing ? (
				<>
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
						autoFocus
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
					/>
					<ImageEditorControls
						config={config}
						protectedReferenceImageIndex={0}
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
				</>
			) : (
				<IconButton className={styles.secondEditButton} onClick={handleStartEditing}>
					<span>快捷编辑</span>
					<span className={styles.secondEditButtonTag}>Tab</span>
				</IconButton>
			)}
		</div>
	)
}
