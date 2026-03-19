// @ts-nocheck
/**
 * 流操作工具函数
 * 提供处理Flow操作相关的功能
 */

import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"

/**
 * 添加节点
 * @param operation 操作对象
 * @param flowInstance 流实例
 */
const addNode = async (operation: any, flowInstance: MagicFlowInstance): Promise<void> => {
	const { nodeType, position, data = {}, params = {} } = operation

	if (!nodeType) {
		throw new Error("添加节点操作缺少 nodeType 字段")
	}

	const nodePosition = position || { x: 100, y: 100 }

	const node = {
		id: `node-${Date.now()}`,
		node_id: `node-${Date.now()}`,
		node_type: nodeType,
		node_version: "1.0.0",
		params,
		position: nodePosition,
		meta: {},
		next_nodes: [],
		step: 0,
		data,
		system_output: null,
	}

	// 使用类型断言解决类型错误
	await (flowInstance as any).addNode(node)
}

/**
 * 更新节点
 * @param operation 操作对象
 * @param flowInstance 流实例
 */
const updateNode = async (operation: any, flowInstance: MagicFlowInstance): Promise<void> => {
	const { nodeId, data, params } = operation

	if (!nodeId) {
		throw new Error("更新节点操作缺少 nodeId 字段")
	}

	try {
		if (data) {
			// 使用类型断言避免TypeScript错误
			await (flowInstance as any).updateNodeData?.(nodeId, data)
		}

		if (params) {
			// 使用类型断言避免TypeScript错误
			await (flowInstance as any).updateNodeParams?.(nodeId, params)
		}
	} catch (error) {
		console.error("更新节点失败:", error)
		throw error
	}
}

/**
 * 删除节点
 * @param operation 操作对象
 * @param flowInstance 流实例
 */
const deleteNode = async (operation: any, flowInstance: MagicFlowInstance): Promise<void> => {
	const { nodeId } = operation

	if (!nodeId) {
		throw new Error("删除节点操作缺少 nodeId 字段")
	}

	await flowInstance.deleteNodes([nodeId])
}

/**
 * 连接节点
 * @param operation 操作对象
 * @param flowInstance 流实例
 */
const connectNodes = async (operation: any, flowInstance: MagicFlowInstance): Promise<void> => {
	const { sourceId, targetId, sourceHandle, targetHandle } = operation

	if (!sourceId || !targetId) {
		throw new Error("连接节点操作缺少 sourceId 或 targetId 字段")
	}

	try {
		// 使用类型断言避免TypeScript错误
		await (flowInstance as any).connectNodes?.(sourceId, targetId, sourceHandle, targetHandle)
	} catch (error) {
		console.error("连接节点失败:", error)
		throw error
	}
}

/**
 * 断开节点连接
 * @param operation 操作对象
 * @param flowInstance 流实例
 */
const disconnectNodes = async (operation: any, flowInstance: MagicFlowInstance): Promise<void> => {
	const { sourceId, targetId } = operation

	if (!sourceId || !targetId) {
		throw new Error("断开节点连接操作缺少 sourceId 或 targetId 字段")
	}

	try {
		// 使用类型断言避免TypeScript错误
		await (flowInstance as any).disconnectNodes?.(sourceId, targetId)
	} catch (error) {
		console.error("断开节点连接失败:", error)
		throw error
	}
}

/**
 * 执行单个流操作
 * @param operation 操作对象
 * @param flowInstance 流实例
 * @param flowId 流ID
 * @returns 是否成功
 */
export const executeOperation = async (
	operation: any,
	flowInstance: MagicFlowInstance,
	flowId: string,
): Promise<boolean> => {
	if (!operation || !flowInstance) return false

	try {
		const { type } = operation

		switch (type) {
			case "addNode":
				await addNode(operation, flowInstance)
				break
			case "updateNode":
				await updateNode(operation, flowInstance)
				break
			case "deleteNode":
				await deleteNode(operation, flowInstance)
				break
			case "connectNodes":
				await connectNodes(operation, flowInstance)
				break
			case "disconnectNodes":
				await disconnectNodes(operation, flowInstance)
				break
			default:
				console.warn(`未知的操作类型: ${type}`)
				return false
		}

		return true
	} catch (error) {
		console.error(`执行操作失败:`, error, operation)
		return false
	}
}

/**
 * 执行流操作
 * @param operations 操作数组
 * @param flowInstance 流实例
 * @param flowId 流ID
 * @param onComplete 完成回调
 * @param onUpdate 更新回调
 */
export const executeOperations = async (
	operations: any[],
	flowInstance: MagicFlowInstance,
	flowId: string,
	onComplete?: () => void,
	onUpdate?: (operation: any, index: number, success: boolean) => void,
): Promise<boolean> => {
	if (!operations || operations.length === 0 || !flowInstance) {
		if (onComplete) onComplete()
		return false
	}

	let success = true

	// 使用Promise.all处理所有操作，避免在循环中直接使用await
	const results = await Promise.all(
		operations.map(async (operation, i) => {
			const operationSuccess = await executeOperation(operation, flowInstance, flowId)

			if (onUpdate) {
				onUpdate(operation, i, operationSuccess)
			}

			return operationSuccess
		}),
	)

	// 检查是否有任何操作失败
	if (results.some((result) => !result)) {
		success = false
	}

	if (onComplete) {
		onComplete()
	}

	return success
}
