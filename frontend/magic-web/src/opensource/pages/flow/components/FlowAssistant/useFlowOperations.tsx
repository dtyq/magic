import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { set } from "lodash-es"
import { FlowApi } from "@/opensource/apis"
import { getLatestNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface UseFlowOperationsProps {
	flowInteractionRef: React.MutableRefObject<any>
	saveDraft: () => Promise<void>
	flowService: any // 可以根据实际类型调整
}

export default function useFlowOperations({
	flowInteractionRef,
	saveDraft,
	flowService,
}: UseFlowOperationsProps) {
	const { t } = useTranslation()
	const commandExecutionRef = useRef<boolean>(false)
	// 用于存储已执行过的commandId
	const executedCommandsRef = useRef<Set<string>>(new Set())

	// 定位到节点
	const goToNode = useMemoizedFn((nodeId: string) => {
		setTimeout(() => {
			if (!flowInteractionRef.current) return

			const node = flowInteractionRef.current.nodes?.find?.(
				(n: MagicFlow.Node) => n.node_id === nodeId,
			)
			if (node && node.width && node.height) {
				flowInteractionRef.current.updateViewPortToTargetNode(node)
			}
		}, 200)
	})

	// 添加节点
	const addNode = useMemoizedFn(async (nodeType: string, nodeId: string, updateList: any[]) => {
		if (!flowInteractionRef.current) return false
		const nodeTemplate = await FlowApi.getNodeTemplate(nodeType)
		updateList.forEach((update: any) => {
			set(nodeTemplate, update.path, update.value)
		})
		nodeTemplate.id = nodeId
		nodeTemplate.node_id = nodeId
		nodeTemplate.node_version = getLatestNodeVersion(nodeType)
		if (Array.isArray(nodeTemplate.meta) && nodeTemplate.meta.length === 0) {
			nodeTemplate.meta = { position: { x: 200, y: 200 } }
		}
		try {
			flowInteractionRef.current.addNode(nodeTemplate)

			setTimeout(() => {
				// 有节点，自动定位到被连线的节点
				goToNode(nodeTemplate.node_id)
			}, 200)
			console.log("节点已添加:", nodeTemplate)
			return true
		} catch (error) {
			console.error("添加节点失败:", error)
			magicToast.error(t("flowAssistant.addNodeError", { ns: "flow" }))
			return false
		}
	})

	// 更新节点
	const updateNode = useMemoizedFn((nodeId: string, updateList: any) => {
		if (!flowInteractionRef.current) return false

		try {
			// 更新节点配置
			const { nodeConfig } = flowInteractionRef.current || {}
			const currentNode = nodeConfig[nodeId]

			goToNode(nodeId)

			if (currentNode) {
				updateList.forEach((update: any) => {
					set(currentNode, update.path, update.value)
				})
				flowInteractionRef.current.updateNodeConfig({ ...currentNode })
			}

			console.log("节点已更新:", nodeId, currentNode)
			return true
		} catch (error) {
			console.error("更新节点失败:", error)
			magicToast.error(t("flowAssistant.updateNodeError", { ns: "flow" }))
			return false
		}
	})

	// 删除节点
	const deleteNode = useMemoizedFn((nodeId: string) => {
		if (!flowInteractionRef.current) return false

		try {
			flowInteractionRef.current.deleteNodes([nodeId])
			console.log("节点已删除:", nodeId)
			return true
		} catch (error) {
			console.error("删除节点失败:", error)
			magicToast.error(t("flowAssistant.deleteNodeError", { ns: "flow" }))
			return false
		}
	})

	// 连接节点
	const connectNodes = useMemoizedFn(
		(sourceNodeId: string, targetNodeId: string, sourceHandleId: string) => {
			if (!flowInteractionRef.current) return false

			try {
				flowInteractionRef.current.onConnect({
					source: sourceNodeId,
					target: targetNodeId,
					sourceHandle: sourceHandleId,
				})
				goToNode(targetNodeId)
				console.log("节点已连接:", sourceNodeId, "->", targetNodeId)
				return true
			} catch (error) {
				console.error("连接节点失败:", error)
				magicToast.error(t("flowAssistant.connectNodesError", { ns: "flow" }))
				return false
			}
		},
	)

	// 断开节点连接
	const disconnectNodes = useMemoizedFn((sourceNodeId: string, targetNodeId: string) => {
		if (!flowInteractionRef.current) return false

		try {
			// 获取当前源节点的下一个节点列表
			const currentFlow = flowInteractionRef.current.getFlow()
			const sourceNode = currentFlow.nodes?.find(
				(node: MagicFlow.Node) => node.id === sourceNodeId,
			)
			const nextNodeIds = (sourceNode?.next_nodes || []).filter(
				(id: string) => id !== targetNodeId,
			)

			// 更新连接
			flowInteractionRef.current.updateNextNodeIdsByDeleteEdge(sourceNodeId, nextNodeIds)
			console.log("节点连接已断开:", sourceNodeId, "->", targetNodeId)
			return true
		} catch (error) {
			console.error("断开节点连接失败:", error)
			magicToast.error(t("flowAssistant.disconnectNodesError", { ns: "flow" }))
			return false
		}
	})

	// 发布流程
	const publishFlow = useMemoizedFn(async (publishData: any, flowId: string) => {
		if (!flowInteractionRef.current) return false

		const currentFlow = flowInteractionRef.current.getFlow()
		if (!currentFlow) return false

		try {
			await flowService.publishFlow(
				{
					name: publishData.name || currentFlow.name,
					description: publishData.description || currentFlow.description,
					magic_flow: currentFlow,
				},
				flowId,
			)

			magicToast.success(t("flowAssistant.publishSuccess", { ns: "flow" }))
			return true
		} catch (error) {
			console.error("Error publishing flow:", error)
			magicToast.error(t("flowAssistant.publishError", { ns: "flow" }))
			return false
		}
	})

	// 执行流程操作命令
	const executeOperations = useMemoizedFn(async (operations: any[], flowId: string) => {
		if (!flowInteractionRef.current) return []

		const results = []
		// 避免在循环中使用await，顺序处理所有操作
		for (let i = 0; i < operations.length; i += 1) {
			const operation = operations[i]

			// 检查是否有commandId，并且是否已执行过
			if (operation.commandId && executedCommandsRef.current.has(operation.commandId)) {
				console.log(
					`操作已执行过，跳过: commandId=${operation.commandId}, type=${operation.type}`,
				)
				results.push({
					type: operation.type,
					success: true,
					skipped: true,
					commandId: operation.commandId,
				})
				continue
			}

			try {
				let result
				switch (operation.type) {
					case "addNode":
						result = addNode(operation.nodeType, operation.nodeId, operation.updateList)
						break
					case "updateNode":
						result = updateNode(operation.nodeId, operation.updateList)
						break
					case "deleteNode":
						result = deleteNode(operation.nodeId)
						break
					case "connectNodes":
						result = connectNodes(
							operation.sourceNodeId,
							operation.targetNodeId,
							operation.sourceHandleId,
						)
						break
					case "disconnectNodes":
						result = disconnectNodes(operation.sourceNodeId, operation.targetNodeId)
						break
					case "saveDraft":
						// 只在saveDraft和publishFlow中使用await，这是必要的异步操作

						result = await saveDraft()
						break
					case "publishFlow":
						result = await publishFlow(operation.publishData, flowId)
						break
					default:
						console.warn("Unknown operation type:", operation.type)
						result = false
				}

				// 如果执行成功且有commandId，则记录到已执行集合中
				if (result && operation.commandId) {
					executedCommandsRef.current.add(operation.commandId)
				}

				results.push({
					type: operation.type,
					success: !!result,
					commandId: operation.commandId,
				})
			} catch (error) {
				console.error(`Error executing operation ${operation.type}:`, error)
				results.push({
					type: operation.type,
					success: false,
					error,
					commandId: operation.commandId,
				})
			}
		}
		return results
	})

	// 重置已执行的命令记录
	const resetExecutedCommands = useMemoizedFn(() => {
		executedCommandsRef.current.clear()
		console.log("已重置命令执行记录")
	})

	return {
		addNode,
		updateNode,
		deleteNode,
		connectNodes,
		disconnectNodes,
		publishFlow,
		executeOperations,
		resetExecutedCommands,
		commandExecutionRef,
	}
}
