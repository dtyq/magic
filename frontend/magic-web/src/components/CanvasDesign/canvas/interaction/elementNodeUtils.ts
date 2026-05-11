import type Konva from "konva"
import type { Canvas } from "../Canvas"

/**
 * 从事件目标沿父链查找第一个在 ElementManager 中存在的元素 id。
 * 用于视频/图片等根 Group 挂 id、内部子节点负责命中与交互的场景。
 */
export function resolveManagedElementIdFromKonvaNode(
	node: Konva.Node,
	canvas: Canvas,
): string | undefined {
	let current: Konva.Node | null = node
	while (current && current !== canvas.stage) {
		const id = current.id()
		if (id && canvas.elementManager.hasElement(id)) {
			return id
		}
		current = current.getParent()
	}
	return undefined
}
