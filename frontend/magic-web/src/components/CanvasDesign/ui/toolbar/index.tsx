import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/shadcn/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { usePortalContainer } from "../primitives/custom/PortalContainerContext"
import { Divider } from "../../public/props"
import IconButton from "../primitives/custom/IconButton/index"
import {
	Film,
	Hand,
	MapPinPlusInside,
	MousePointer2,
	Type,
	Image as ImageIcon,
	Mic,
	Upload,
} from "lucide-react"
import { ImageSparkles, AssetLibraryIcon } from "../primitives/icons/index"
import styles from "./index.module.css"
import { useCanvas } from "../../app/providers/CanvasProvider"
import { useState, useCallback, useRef, type ChangeEvent } from "react"
import { useCanvasEvent, useCanvasEventOnce } from "../../app/hooks/canvas"
import type { BaseTool } from "../../runtime/interaction/tools/BaseTool"
import { SelectionTool } from "../../runtime/interaction/tools/SelectionTool"
import { PanTool } from "../../runtime/interaction/tools/PanTool"
import { MarkerTool } from "../../runtime/interaction/tools/MarkerTool"
import { TextTool } from "../../runtime/interaction/tools/TextTool"
import { VideoGeneratorTool } from "../../runtime/interaction/tools/VideoGeneratorTool"
import { AudioGeneratorTool } from "../../runtime/interaction/tools/AudioGeneratorTool"
import { ToolTypeEnum, type ToolType } from "../../runtime/document/types"
import type { ToolOptionItem } from "./types"
import ToolItemWithPopover from "./ToolItemWithPopover"
import PluginTool from "./PluginTool"
import { useCanvasDesignI18n } from "../../app/providers/I18nProvider"
import { useMagic } from "../../app/providers/MagicProvider"
import {
	getMediaDimensions,
	isImageFile,
	isVideoFile,
	isAudioFile,
	validateFile,
} from "../../runtime/shared/ids"
import { AUDIO_CONFIG } from "../../runtime/elements/audio/AudioElement.config"
import { resolveNearestFreeMediaPlacement } from "../../runtime/shared/placement/placementEngine"
import AssetsModal from "./AssetsModal"
import type { AssetItem } from "@/apis"
import { useToolCreationDrag } from "./useToolCreationDrag"

/**
 * 将 BaseTool 转换为 ToolType
 */
function toolToToolType(tool: BaseTool | null): ToolType | null {
	if (!tool) return null
	if (tool instanceof SelectionTool) {
		return ToolTypeEnum.Select
	}
	if (tool instanceof PanTool) {
		return ToolTypeEnum.Hand
	}
	if (tool instanceof MarkerTool) {
		return ToolTypeEnum.Marker
	}
	if (tool instanceof TextTool) {
		return ToolTypeEnum.Text
	}
	if (tool instanceof VideoGeneratorTool) {
		return ToolTypeEnum.VideoGenerator
	}
	if (tool instanceof AudioGeneratorTool) {
		return ToolTypeEnum.AudioGenerator
	}
	return null
}

export default function Tools() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { imageModelList, permissions, videoModelList } = useMagic()
	const portalContainer = usePortalContainer()
	const [activeTool, setActiveToolState] = useState<ToolType | null>(null)
	const [assetsVisible, setAssetsVisible] = useState(false)
	const imageUploadInputRef = useRef<HTMLInputElement>(null)
	const videoUploadInputRef = useRef<HTMLInputElement>(null)
	const audioUploadInputRef = useRef<HTMLInputElement>(null)
	const uploadPositionRef = useRef<{ x: number; y: number } | null>(null)
	const { onPointerDown, dragPreview } = useToolCreationDrag()

	// 监听 Canvas 的工具状态变化
	useCanvasEvent("tool:change", ({ data }) => {
		setActiveToolState(data.tool)
	})

	// 监听 Canvas 初始化完成事件，同步初始工具状态（只触发一次）
	useCanvasEventOnce("canvas:ready", () => {
		if (!canvas) return
		const currentTool = canvas.toolManager.getActiveTool()
		const toolType = toolToToolType(currentTool)
		setActiveToolState(toolType)
	})

	// 设置激活工具的方法
	const setActiveTool = useCallback(
		(tool: ToolType | null) => {
			if (!canvas) return
			const toolManager = canvas.toolManager
			// 激活新工具（标记为 UI 来源）
			if (tool === ToolTypeEnum.ImageGenerator) {
				// 图像生成工具：直接插入 Image 元素，传递 imageModelList 用于获取默认尺寸
				toolManager.getImageGeneratorTool().createImageAtCenter(imageModelList)
			} else if (tool === ToolTypeEnum.VideoGenerator) {
				toolManager.getVideoGeneratorTool().createVideoAtCenter(videoModelList)
			} else if (tool === ToolTypeEnum.AudioGenerator) {
				toolManager.getAudioGeneratorTool().createAudioAtCenter()
			} else if (tool) {
				toolManager.setActiveToolByType(tool, "ui")
			} else {
				// 其他工具暂时不支持，设置为 null
				toolManager.setActiveTool(null)
			}
			// 状态更新由事件监听器处理
		},
		[canvas, imageModelList, videoModelList],
	)

	const getUploadAnchorPosition = useCallback(
		async (file: File) => {
			if (!canvas) return null

			const { width, height } = isAudioFile(file)
				? { width: AUDIO_CONFIG.DEFAULT_WIDTH, height: AUDIO_CONFIG.DEFAULT_HEIGHT }
				: await getMediaDimensions(file)
			const targetPosition = resolveNearestFreeMediaPlacement(canvas, { width, height })

			return {
				x: targetPosition.x + width / 2,
				y: targetPosition.y + height / 2,
			}
		},
		[canvas],
	)

	const handleAssetsConfirm = useCallback(
		async (assets: AssetItem[]) => {
			if (!canvas || !canvas.permissionManager.can("document.write")) {
				throw new Error("Canvas is not writable")
			}

			const createdElementIds: string[] = []
			try {
				for (const asset of assets) {
					const imported = await canvas.assetImportManager.importAndCreateElement({
						assetId: asset.asset_id,
						allowedMediaTypes: ["image", "video"],
					})
					createdElementIds.push(imported.elementId)
				}
				if (createdElementIds.length > 0) {
					canvas.selectionManager.selectMultiple(createdElementIds)
				}
			} catch (error) {
				// A multi-asset import is one user action; remove elements already
				// created in this action if a later asset cannot be imported.
				if (createdElementIds.length > 0) {
					canvas.elementManager.batchDelete(createdElementIds)
				}
				throw error
			}
		},
		[canvas],
	)

	const handleUploadFiles = useCallback(
		async (files: File[], type: "image" | "video" | "audio") => {
			// 文件选择完成后保留菜单发起时的落点，后续菜单关闭不影响上传。
			const requestedPosition = uploadPositionRef.current
			uploadPositionRef.current = null
			if (!canvas || !canvas.permissionManager.can("document.write") || files.length === 0)
				return

			const validFiles = files.filter((file) => {
				const validation = validateFile(file)
				if (!validation.valid) return false
				if (type === "image") return isImageFile(file)
				if (type === "video") return isVideoFile(file)
				return isAudioFile(file)
			})
			if (validFiles.length === 0) return

			const anchorPosition =
				requestedPosition ?? (await getUploadAnchorPosition(validFiles[0]))
			if (!anchorPosition) return

			await canvas.clipboardManager.pasteMultipleCanvasFiles(validFiles, anchorPosition)
		},
		[canvas, getUploadAnchorPosition],
	)

	const handleImageUploadChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files || [])
			event.target.value = ""
			await handleUploadFiles(files, "image")
		},
		[handleUploadFiles],
	)

	const handleVideoUploadChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files || [])
			event.target.value = ""
			await handleUploadFiles(files, "video")
		},
		[handleUploadFiles],
	)

	const handleAudioUploadChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files || [])
			event.target.value = ""
			await handleUploadFiles(files, "audio")
		},
		[handleUploadFiles],
	)

	const openLocalUploadPicker = useCallback(
		(type: "image" | "video" | "audio", position?: { x: number; y: number }) => {
			if (!canvas || !canvas.permissionManager.can("document.write")) return

			const input =
				type === "image"
					? imageUploadInputRef.current
					: type === "video"
						? videoUploadInputRef.current
						: audioUploadInputRef.current
			if (!input) return

			uploadPositionRef.current = position ?? null
			input.value = ""
			input.click()
		},
		[canvas],
	)

	useCanvasEvent(
		"ui:upload:request",
		({ data }) => {
			openLocalUploadPicker(data.mediaType, data.position)
		},
		[openLocalUploadPicker],
	)

	const tools: Array<ToolOptionItem | typeof Divider> = [
		{
			label: t("tools.selection", "选择工具"),
			icon: MousePointer2,
			value: ToolTypeEnum.Select,
			shortcut: ["V"],
		},
		{
			label: t("tools.hand", "抓手工具"),
			icon: Hand,
			value: ToolTypeEnum.Hand,
			shortcut: ["H", t("tools.space", "空格")],
		},
		// {
		// 	label: "形状",
		// 	children: [
		// 		{
		// 			label: "矩形",
		// 			icon: Square,
		// 			value: ToolTypeEnum.Rect,
		// 		},
		// 		{
		// 			label: "圆形",
		// 			icon: Circle,
		// 			value: ToolTypeEnum.Ellipse,
		// 		},
		// 		{
		// 			label: "三角形",
		// 			icon: Triangle,
		// 			value: ToolTypeEnum.Triangle,
		// 		},
		// 		{
		// 			label: "星形",
		// 			icon: Star,
		// 			value: ToolTypeEnum.Star,
		// 		},
		// 	],
		// },
		// {
		// 	label: t("tools.frame", "画框"),
		// 	icon: Frame,
		// 	value: ToolTypeEnum.Frame,
		// 	shortcut: ["F"],
		// },
		Divider,
		{
			label: t("tools.text", "文本"),
			icon: Type,
			value: ToolTypeEnum.Text,
			shortcut: ["T"],
		},
		{
			label: t("tools.imageGenerator", "图像生成"),
			icon: ImageSparkles,
			value: ToolTypeEnum.ImageGenerator,
			shortcut: ["A"],
		},
		{
			label: t("tools.videoGenerator", "视频生成"),
			icon: Film,
			value: ToolTypeEnum.VideoGenerator,
		},
		{
			label: t("tools.audioGenerator", "音频生成"),
			icon: Mic,
			value: ToolTypeEnum.AudioGenerator,
		},
		{
			label: t("tools.assets", "素材库"),
			icon: AssetLibraryIcon,
			onClick: () => setAssetsVisible(true),
		},
		Divider,
		{
			label: t("tools.marker", "标记"),
			icon: MapPinPlusInside,
			value: ToolTypeEnum.Marker,
			shortcut: ["M"],
		},
		{
			label: t("tools.upload", "上传"),
			icon: Upload,
			children: [
				{
					label: t("tools.uploadImage", "上传图片"),
					icon: ImageIcon,
					onClick: () => {
						openLocalUploadPicker("image")
					},
				},
				{
					label: t("tools.uploadVideo", "上传视频"),
					icon: Film,
					onClick: () => {
						openLocalUploadPicker("video")
					},
				},
				{
					label: t("tools.uploadAudio", "上传音频"),
					icon: Mic,
					onClick: () => {
						openLocalUploadPicker("audio")
					},
				},
			],
		},
	]

	const canShowDesignPluginEntry = permissions?.showPluginEntry === true

	return (
		<div className={styles.tools} data-canvas-ui-component>
			<input
				ref={imageUploadInputRef}
				type="file"
				accept="image/*"
				multiple
				style={{ display: "none" }}
				onChange={handleImageUploadChange}
			/>
			<input
				ref={videoUploadInputRef}
				type="file"
				accept="video/*"
				multiple
				style={{ display: "none" }}
				onChange={handleVideoUploadChange}
			/>
			<input
				ref={audioUploadInputRef}
				type="file"
				accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/m4a,audio/aac,audio/x-aac,.mp3,.wav,.ogg,.m4a,.aac"
				multiple
				style={{ display: "none" }}
				onChange={handleAudioUploadChange}
			/>
			{tools.map((item, index) => {
				if (item === Divider) {
					return <div key={`${item}-${index}`} className={styles.divider} />
				}

				// 有 children 但没有 value 的情况，使用 Popover
				if (item.children && !item.value) {
					return (
						<ToolItemWithPopover
							key={index}
							item={item}
							activeTool={activeTool}
							setActiveTool={setActiveTool}
						/>
					)
				}

				// 普通工具项，使用 Tooltip
				const IconComponent = item.icon
				if (!IconComponent) return null

				return (
					<Tooltip delayDuration={0} key={item.value ?? item.label}>
						<TooltipTrigger>
							<IconButton
								className={styles.toolItem}
								selected={item.value === activeTool}
								onPointerDown={(event) =>
									onPointerDown(event, item.value, item.label)
								}
								onClick={() => {
									if (item.value) setActiveTool(item.value)
									item.onClick?.()
								}}
							>
								<IconComponent size={16} />
							</IconButton>
						</TooltipTrigger>
						<TooltipPrimitive.Portal container={portalContainer || undefined}>
							<TooltipContent
								side="top"
								sideOffset={8}
								className="border-black bg-black"
							>
								<div>
									<span className={styles.tooltipLabel}>{item.label}</span>
									{item.shortcut?.length && (
										<>
											&nbsp;&nbsp;
											<span className={styles.tooltipShortcut}>
												{item.shortcut.join("/")}
											</span>
										</>
									)}
								</div>
								<TooltipPrimitive.Arrow className="fill-black" />
							</TooltipContent>
						</TooltipPrimitive.Portal>
					</Tooltip>
				)
			})}
			{canShowDesignPluginEntry && (
				<>
					<div className={styles.divider} />
					<PluginTool />
				</>
			)}
			<AssetsModal
				open={assetsVisible}
				onClose={() => setAssetsVisible(false)}
				onConfirmMultiple={handleAssetsConfirm}
				mediaTypes={["IMAGE", "VIDEO"]}
				multiple
			/>
			{dragPreview}
		</div>
	)
}
