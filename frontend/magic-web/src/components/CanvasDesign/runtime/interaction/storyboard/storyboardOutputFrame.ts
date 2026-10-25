import type { Canvas } from "../../core/Canvas"
import { getActiveContent, getUsableDownstreamImageContent } from "../../document/elementContent"
import { getCanvasElementChildren } from "../../document/elementIndex"
import {
	ElementTypeEnum,
	type ImageElement,
	type LayerElement,
	type StoryboardElement,
	type StoryboardElementContent,
} from "../../document/types"

function collectImageIds(elements: LayerElement[] | undefined, result: string[]): void {
	for (const element of elements ?? []) {
		if (element.visible === false) continue
		const children = getCanvasElementChildren(element)
		if (children) {
			collectImageIds(children, result)
			continue
		}
		if (element.type === ElementTypeEnum.Image) result.push(element.id)
	}
}

function getConnectedStoryboardOutputIds(canvas: Canvas, imageId: string): Set<string> {
	const storyboardIds = new Set<string>()
	for (const connection of canvas.connectionManager.getUpstreamConnections(imageId)) {
		const source = canvas.elementManager.getElementData(connection.sourceElementId)
		if (source?.type !== ElementTypeEnum.Storyboard) continue

		const content = getActiveContent<StoryboardElementContent>(source as StoryboardElement)
		if (content?.shots?.some((shot) => shot.outputImageElementId === imageId)) {
			storyboardIds.add(source.id)
		}
	}
	return storyboardIds
}

/**
 * 判断 Frame 是否为 Storyboard 生成的图片输出组合。
 * 判定依赖 Storyboard shots 与持久化连接，不依赖 Frame 名称。
 */
export function isStoryboardOutputFrame(canvas: Canvas, frameId: string): boolean {
	const frame = canvas.elementManager.getElementData(frameId)
	if (frame?.type !== ElementTypeEnum.Frame || frame.visible === false) return false

	const imageIds: string[] = []
	collectImageIds(frame.children, imageIds)
	if (imageIds.length === 0) return false

	const storyboardIds = new Set<string>()
	let hasOutput = false

	for (const imageId of imageIds) {
		const image = canvas.elementManager.getElementData(imageId)
		if (image?.type !== ElementTypeEnum.Image) continue
		const connectedStoryboardIds = getConnectedStoryboardOutputIds(canvas, imageId)
		if (connectedStoryboardIds.size === 0) {
			if (getUsableDownstreamImageContent(image as ImageElement)) return false
			continue
		}
		if (connectedStoryboardIds.size !== 1) return false

		hasOutput = true
		connectedStoryboardIds.forEach((storyboardId) => storyboardIds.add(storyboardId))
	}

	return hasOutput && storyboardIds.size === 1
}
