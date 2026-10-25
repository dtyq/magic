import type { Canvas } from "../../core/Canvas"
import type { SelectionContentSnapshot } from "../selection/selectionContentCollector"
import type { ConnectionCreationSuccess } from "./connectionCreationTypes"

export interface SelectionConnectionCreationContext {
	canvas: Canvas
	snapshot: SelectionContentSnapshot
	originSide: "left" | "right"
	createElement: () => string | null
	rollbackElement?: (elementId: string) => void
	afterConnect?: (result: ConnectionCreationSuccess) => void
}

/**
 * 将“创建元素 + 多条根级连接”收敛为一个历史事务。连接失败时回滚新元素，
 * 这样基础菜单项和条件 Recipe 共享同一条原子创建管线。
 */
export function createElementFromSelectionConnection(
	context: SelectionConnectionCreationContext,
): string | null {
	const { canvas, snapshot } = context
	if (snapshot.rootElementIds.length < 2 || !snapshot.allRootsCanConnect) return null

	return canvas.historyManager.runTransaction(
		() => {
			const createdElementId = context.createElement()
			if (!createdElementId) return null

			const edges =
				context.originSide === "right"
					? snapshot.rootElementIds.map((sourceElementId) => ({
							sourceElementId,
							targetElementId: createdElementId,
						}))
					: snapshot.rootElementIds.map((targetElementId) => ({
							sourceElementId: createdElementId,
							targetElementId,
						}))
			const connection = canvas.connectionManager.connectElementsBatch({ edges })
			if (connection.status !== "created") {
				;(
					context.rollbackElement ??
					((elementId) => canvas.elementManager.delete(elementId))
				)(createdElementId)
				return null
			}

			context.afterConnect?.({
				createdElementId,
				connectionIds: connection.connectionIds,
			})
			return createdElementId
		},
		(result) => result !== null,
	)
}
