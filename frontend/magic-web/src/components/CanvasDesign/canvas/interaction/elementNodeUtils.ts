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

/**
 * 将 stage 指针坐标映射到 contentLayer 后，在「当前选中集合」里按几何命中解析元素 id。
 * 用于 multi-selection-proxy 在 controlsLayer 拦截命中、无法沿 Konva 父链解析 id 的场景。
 * 多个选中重叠时，优先取选中集合迭代序中较后的一项（通常更接近「后选中」）。
 */
export function pickSelectedElementIdAtStagePointer(
	canvas: Canvas,
	pointerPos: { x: number; y: number },
): string | undefined {
	const layerTransform = canvas.contentLayer.getAbsoluteTransform().copy().invert()
	const layerPos = layerTransform.point(pointerPos)
	const adapter = canvas.elementManager.getNodeAdapter()
	const selectedIds = canvas.selectionManager.getSelectedIds()

	for (let i = selectedIds.length - 1; i >= 0; i--) {
		const elementId = selectedIds[i]
		if (!elementId) {
			continue
		}

		const bounds = adapter.getElementBounds(elementId)
		if (!bounds) {
			continue
		}

		const inside =
			layerPos.x >= bounds.x &&
			layerPos.x <= bounds.x + bounds.width &&
			layerPos.y >= bounds.y &&
			layerPos.y <= bounds.y + bounds.height

		if (inside) {
			return elementId
		}
	}

	return undefined
}
