import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { usePortalContainer } from "../ui/custom/PortalContainerContext"
import { Divider } from "../../types"
import IconButton from "../ui/custom/IconButton"
import {
	MousePointer2,
	// Type,
	// Frame,
	Hand,
	MapPinPlusInside,
	ImageSparkles,
	// Square,
	// Circle,
	// Triangle,
	// Star,
} from "../ui/icons/index"
import styles from "./index.module.css"
import { useLayersUI } from "../../context/LayersUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { useState, useCallback } from "react"
import { useCanvasEvent, useCanvasEventOnce } from "../../hooks/useCanvasEvent"
import type { BaseTool } from "../../canvas/interaction/tools/BaseTool"
import { SelectionTool } from "../../canvas/interaction/tools/SelectionTool"
import { PanTool } from "../../canvas/interaction/tools/PanTool"
import { MarkerTool } from "../../canvas/interaction/tools/MarkerTool"
import { ToolTypeEnum, type ToolType } from "../../canvas/types"
import type { ToolOptionItem } from "./types"
import ToolItemWithPopover from "./ToolItemWithPopover"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useMagic } from "../../context/MagicContext"

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
	return null
}

export default function Tools() {
	const { t } = useCanvasDesignI18n()
	const layersState = useLayersUI()
	const { canvas } = useCanvas()
	const { imageModelList } = useMagic()
	const portalContainer = usePortalContainer()
	const [activeTool, setActiveToolState] = useState<ToolType | null>(null)

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
			} else if (tool) {
				toolManager.setActiveToolByType(tool, "ui")
			} else {
				// 其他工具暂时不支持，设置为 null
				toolManager.setActiveTool(null)
			}
			// 状态更新由事件监听器处理
		},
		[canvas, imageModelList],
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
		// 	label: t("tools.text", "文本"),
		// 	icon: Type,
		// 	value: ToolTypeEnum.Text,
		// 	shortcut: ["T"],
		// },
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
			label: t("tools.imageGenerator", "图像生成"),
			icon: ImageSparkles,
			value: ToolTypeEnum.ImageGenerator,
			shortcut: ["A"],
		},
		{
			label: t("tools.marker", "标记"),
			icon: MapPinPlusInside,
			value: ToolTypeEnum.Marker,
			shortcut: ["M"],
		},
	]

	return (
		<div
			className={styles.tools}
			style={{
				left: layersState.collapsed ? 8 : layersState.width + 16,
				transition: layersState.transitionAnimation,
			}}
			data-canvas-ui-component
		>
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
					<Tooltip key={item.value}>
						<TooltipTrigger>
							<IconButton
								className={styles.toolItem}
								selected={item.value === activeTool}
								onClick={() => {
									if (item.value) setActiveTool(item.value)
								}}
							>
								<IconComponent size={16} />
							</IconButton>
						</TooltipTrigger>
						<TooltipPrimitive.Portal container={portalContainer || undefined}>
							<TooltipContent
								side="right"
								sideOffset={8}
								className="border-black bg-black"
							>
								<div>
									<span className={styles.tooltipLabel}>{item.label}</span>
									&nbsp;&nbsp;
									{item.shortcut?.length && (
										<span className={styles.tooltipShortcut}>
											{item.shortcut?.join("/")}
										</span>
									)}
								</div>
								<TooltipPrimitive.Arrow className="fill-black" />
							</TooltipContent>
						</TooltipPrimitive.Portal>
					</Tooltip>
				)
			})}
		</div>
	)
}
