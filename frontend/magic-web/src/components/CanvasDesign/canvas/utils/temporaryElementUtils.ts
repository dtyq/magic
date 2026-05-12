import type {
	CanvasDocument,
	// LayerElement
} from "../types"

/**
 * 规范化图层树（递归处理子节点）。
 * 本地上传中、仅存在于内存的占位图层由 ElementManager.temporaryElements 标记，
 * 导出时已排除；DSL 中 status=processing 且无 src 的占位需要保留并在画布上显示「生成中」。
 */
// export function sanitizeLayerElements(elements: LayerElement[]): LayerElement[] {
// 	return elements.map((element) => {
// 		if ("children" in element && element.children && Array.isArray(element.children)) {
// 			return {
// 				...element,
// 				children: sanitizeLayerElements(element.children),
// 			}
// 		}

// 		return element
// 	})
// }

export function sanitizeCanvasDocument(doc: CanvasDocument): CanvasDocument {
	return {
		...doc,
		// elements: sanitizeLayerElements(doc.elements || []),
		elements: doc.elements || [],
	}
}
