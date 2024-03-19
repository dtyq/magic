import React from 'react'
import { useReactFlow } from 'reactflow'

type UseNodeSizeAndPos = {
	id: string
}

export default function useNodePositionAndSize({ id }: UseNodeSizeAndPos) {

	const reactFlowInstance = useReactFlow()

	// 获取当前节点的坐标和尺寸
	const node = reactFlowInstance.getNode(id)

	return {
		width: node?.width,
		height: node?.height,
		x: node?.position?.x,
		y: node?.position?.y
	}
}
