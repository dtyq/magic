import type { PPTNode, Slide } from "../types/index"
import { log, LogLevel } from "../logger"
import { throwIfAborted } from "../renderer/abort"
import { drawShape } from "./drawShape"
import { drawImage } from "./drawImage"
import { drawText } from "./drawText"
import { drawTable } from "./drawTable"
import { drawBorderLine } from "./drawBorderLine"
import { drawMedia } from "./drawMedia"

/**
 * 绘制 PPTNode 到幻灯片
 */
export async function draw(
	slide: Slide,
	node: PPTNode,
	signal?: AbortSignal,
): Promise<void> {
	throwIfAborted(signal)
	try {
		switch (node.type) {
			case "shape":
				drawShape(slide, node)
				break
			case "image":
				await drawImage(slide, node, signal)
				break
			case "text":
				drawText(slide, node)
				break
			case "table":
				drawTable(slide, node)
				break
			case "borderLine":
				drawBorderLine(slide, node)
				break
			case "media":
				drawMedia(slide, node, signal)
				break
			default:
				log(LogLevel.L3, "Unknown node type", { type: (node as PPTNode).type })
		}
	} catch (error) {
		log(LogLevel.L4, "Failed to draw node", { type: node.type, error: String(error) })
	}
}

/**
 * 批量绘制
 */
export async function drawAll(
	slide: Slide,
	nodes: PPTNode[],
	signal?: AbortSignal,
): Promise<void> {
	for (const node of nodes) {
		throwIfAborted(signal)
		await draw(slide, node, signal)
	}
}

export { drawShape, drawImage, drawText, drawTable, drawBorderLine, drawMedia }
