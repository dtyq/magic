import type { Canvas } from "../../core/Canvas"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import type { ConnectionCreationSuccess } from "./connectionCreationTypes"

type ElementConnectionOrigin = Extract<ConnectionOrigin, { kind: "element" }>

export interface ElementConnectionCreationContext {
	canvas: Canvas
	origin: ElementConnectionOrigin
	createElement: () => string | null
	rollbackElement?: (elementId: string) => void
	afterConnect?: (result: ConnectionCreationSuccess) => void
}

/** 将单元素菜单的“创建节点 + 建立连接”合并成一条历史记录。 */
export function createElementFromElementConnection(
	context: ElementConnectionCreationContext,
): string | null {
	const { canvas, origin } = context
	return canvas.historyManager.runTransaction(
		() => {
			const createdElementId = context.createElement()
			if (!createdElementId) return null

			const connection = canvas.connectionManager.connectElements(
				origin.side === "right"
					? {
							sourceElementId: origin.elementId,
							targetElementId: createdElementId,
						}
					: {
							sourceElementId: createdElementId,
							targetElementId: origin.elementId,
						},
			)
			if (connection.status !== "created") {
				;(
					context.rollbackElement ??
					((elementId) => canvas.elementManager.delete(elementId))
				)(createdElementId)
				return null
			}

			context.afterConnect?.({
				createdElementId,
				connectionIds: [connection.connectionId],
			})
			return createdElementId
		},
		(result) => result !== null,
	)
}
