import type {
	PPTBorderLineNode,
	PPTImageNode,
	PPTMediaNode,
	PPTNode,
	PPTShapeNode,
	PPTTableNode,
	PPTTextNode,
} from "./node"

/**
 * Serialization layer: PPT node shapes and wrappers used across the worker boundary.
 * Main-thread to worker postMessage must use SerializablePPTNode with DOM references removed.
 */

export interface SerializablePPTImageNode
	extends Omit<
		PPTImageNode,
		"capture" | "captureElement" | "captureBackgroundOnly" | "captureExcludeSvgText"
	> {}

export interface SerializablePPTShapeNode extends PPTShapeNode {}

export interface SerializablePPTTextNode extends PPTTextNode {}

export interface SerializablePPTTableNode extends PPTTableNode {}

export interface SerializablePPTBorderLineNode extends PPTBorderLineNode {}

export interface SerializablePPTMediaNode extends Omit<PPTMediaNode, "coverCaptureElement"> {}

export type SerializablePPTNode =
	| SerializablePPTShapeNode
	| SerializablePPTImageNode
	| SerializablePPTTextNode
	| SerializablePPTTableNode
	| SerializablePPTBorderLineNode
	| SerializablePPTMediaNode

// Node to serializable node
// ============================================================================

/**
 * Remove DOM references from PPT nodes so they can be sent to the worker through postMessage.
 */
export function serializePptNodes(nodes: PPTNode[]): SerializablePPTNode[] {
	return nodes.map((node) => {
		if (node.type === "image") {
			const {
				capture,
				captureElement,
				captureBackgroundOnly,
				captureExcludeSvgText,
				...serializableNode
			} = node
			void capture
			void captureElement
			void captureBackgroundOnly
			void captureExcludeSvgText
			return serializableNode as SerializablePPTNode
		}

		if (node.type === "media") {
			const { coverCaptureElement, ...serializableNode } = node
			void coverCaptureElement
			return serializableNode as SerializablePPTNode
		}

		return { ...node } as SerializablePPTNode
	})
}
