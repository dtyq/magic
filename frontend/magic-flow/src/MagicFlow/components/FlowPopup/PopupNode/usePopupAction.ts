import { useExternalConfig } from '@/MagicFlow/context/ExternalContext/useExternal'
import { useFlowEdges, useNodeConfig, useNodeConfigActions } from '@/MagicFlow/context/FlowContext/useFlow'
import { useMemoizedFn } from 'ahooks'
import { useFlowInteractionActions } from '../../FlowDesign/context/FlowInteraction/useFlowInteraction'
import { generateLoopBody, getLatestNodeVersion, getNodeSchema, handleRenderProps, judgeLoopNode, searchLoopRelationNodesAndEdges } from '@/MagicFlow/utils'
import { WidgetValue } from '@/MagicFlow/examples/BaseFlow/common/Output'
import { useCurrentNode } from '@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode'
import { InnerHandleType } from '@/MagicFlow/nodes'
import _ from 'lodash'
import { useNodes } from '@/MagicFlow/context/NodesContext/useNodes'

type UsePopupActionProps = {
	// 切换目标类型
	targetNodeId?: string
}

export default function usePopupAction({ targetNodeId }: UsePopupActionProps) {

    const { nodeConfig } = useNodeConfig()

    const { setNodeConfig, updateNodeConfig } = useNodeConfigActions()

	const { setEdges, edges } = useFlowEdges()

	const { nodes, setNodes } = useNodes()

	const { paramsName } = useExternalConfig()

	const { resetLastLayoutData } = useFlowInteractionActions()

	const { currentNode } = useCurrentNode()


	// 更换节点类型
	const toggleType = useMemoizedFn(({ key: targetNodeType }) => {
		const node = nodeConfig[targetNodeId as string]

		const nodeSchema = getNodeSchema(targetNodeType)

		const resultData = {
			...node,
			// 携带上节点的output
			output: nodeSchema?.output as WidgetValue['value'],
			// 携带上节点的input
			input: nodeSchema?.input as WidgetValue['value'],
			// 变更节点类型
			[paramsName.nodeType]: targetNodeType,
			// 重置节点配置
			[paramsName.params]: _.cloneDeep(nodeSchema.params),
			name: nodeSchema.label,
            node_version: getLatestNodeVersion(nodeSchema.id),
            data: {
                icon: null
            }
		}
		
		handleRenderProps(resultData, resultData.step, paramsName)

		updateNodeConfig(resultData)

		const sourceNodeType = currentNode?.[paramsName.nodeType]

		// 如果从普通类型节点切换为循环节点
		if (judgeLoopNode(targetNodeType) && !judgeLoopNode(sourceNodeType)) {
			// 当前切换节点是否有下一个节点
			const toNextEdge = edges.find(e => e.source === node.id)
			const { newNodes: bodyNodes, newEdges: bodyEdges } = generateLoopBody(
				resultData,
				paramsName,
				edges,
			)
			// 如果有下一个节点，则手动把原来连向下一个节点的sourceHandle改成「循环体的下一个节点端点」
			if(!!toNextEdge) {
				toNextEdge.sourceHandle = InnerHandleType.LoopNext
			}
			// 将body节点挂载到nodeConfig
			bodyNodes.forEach(bodyNode => {
				nodeConfig[bodyNode.id] = bodyNode
			})
			setNodes([...nodes, ...bodyNodes])
			setEdges([...edges, ...bodyEdges])
			setNodeConfig({...nodeConfig})
		} else if(judgeLoopNode(sourceNodeType) && !judgeLoopNode(targetNodeType)) {
			// 如果从循环节点类型切换为普通节点类型，需要删掉循环体及其相关节点及边
			const { nodeIds, edgeIds } = searchLoopRelationNodesAndEdges(node, nodes, edges)
			console.log("循环内相关的边", edgeIds)
			console.log("循环内相关的节点", nodeIds)
			// 移除nodeConfig相关的节点
			nodeIds.forEach(nId => {
				delete nodeConfig[nId]
			})
			setNodeConfig({...nodeConfig})
			setNodes(nodes.filter(n => !nodeIds.includes(n.id)))
			setEdges(edges.filter(e => !edgeIds.includes(e.id)))
		}
		else {
			setNodes([...nodes])
		}

		// 重置布局属性
		resetLastLayoutData()
	})

	return {
		toggleType
	}
}
