import { getExecuteNodeList } from "@/MagicFlow/constants"
import { useFlowData } from "@/MagicFlow/context/FlowContext/useFlow"
import { BaseNodeType } from "@/MagicFlow/register/node"
import { getNodeGroups } from "@/MagicFlow/utils"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"


type MaterialProps = {
	keyword:string
}

export default function useMaterial ({ keyword }: MaterialProps) {
    // 缓存nodeList的结果，避免每次渲染时都创建新的引用
    const nodeList = getExecuteNodeList()

    const { flow } = useFlowData()

	// 动态的节点列表
	const dynamicNodeList = useMemo(() => {
		return nodeList.filter(n => n.schema.label.includes(keyword))
	}, [keyword, nodeList])

	// 获取分组节点列表
	const getGroupNodeList = useMemoizedFn((nodeTypes: BaseNodeType[]) => {
		return dynamicNodeList.filter(n => {
			return nodeTypes.includes(n.schema.id)
		})
	})

	// 过滤出有节点数据的分组列表，并往里边塞节点的schema
	const filterNodeGroups = useMemo(() => {
		const allNodeGroups = getNodeGroups()
		return allNodeGroups.map(nodeGroup => {
			const dynamicNodes = getGroupNodeList(nodeGroup.nodeTypes)
			const nodeTypes = dynamicNodes.map(n => n.schema.id)

			if( nodeTypes?.length === 0) return null

			return {
				...nodeGroup,
				nodeTypes,
				nodeSchemas: dynamicNodes,
				isGroupNode: nodeGroup.children?.length! > 0
			}
		}).filter(n => !!n)
	}, [getGroupNodeList, keyword, flow])

	return {
		nodeList: dynamicNodeList,
		getGroupNodeList,
		filterNodeGroups
	}
}
