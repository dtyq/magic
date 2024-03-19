/** 当日志运行错误时，定位到错误的节点 */
import { useNodeTesting } from '@/MagicFlow/context/NodeTesingContext/useNodeTesting'
import React from 'react'
import useViewport from '../../common/hooks/useViewport'
import { useUpdateEffect } from 'ahooks'
import { useFlow } from '@/MagicFlow/context/FlowContext/useFlow'
import { useNodes } from '@/MagicFlow/context/NodesContext/useNodes'

export default function useTargetToErrorNode() {
	const { testingResultMap, position } = useNodeTesting()
	const { updateViewPortToTargetNode } = useViewport()
	const { nodes } = useNodes()

	useUpdateEffect(() => {
		if (!testingResultMap || !position) return
		const [errorNodeId] = Object.entries(testingResultMap)
			.filter(([, nodeDebug]) => {
				return !nodeDebug.success
			})
			.map(([nodeId]) => nodeId)
		
		// console.log("errorNodeId", errorNodeId, testingResultMap)
		// 存在错误，则定位到错误的节点id
		if (errorNodeId) {
			const errorNode = nodes.find((n) => n.node_id === errorNodeId)
			// console.log("errorNode", errorNode)
			if (!errorNode?.width) return
			updateViewPortToTargetNode(errorNode)
		}
		// 全都成功，则定位到最后一个节点
		else{
			const testNodeIds = Object.keys(testingResultMap)
			const [lastSuccessNodeId] = Object.entries(testingResultMap).filter(([, testConfig]) => {
				const filterChildrenIds = testConfig?.children_ids?.filter?.(id => testNodeIds.includes(id))
				return filterChildrenIds?.length === 0
			}).map(([nodeId]) => nodeId)
			const lastSuccessNode = nodes.find((n) => n.node_id === lastSuccessNodeId)
			if (!lastSuccessNode?.width) return
			updateViewPortToTargetNode(lastSuccessNode)
		}
	}, [testingResultMap, position])
}
