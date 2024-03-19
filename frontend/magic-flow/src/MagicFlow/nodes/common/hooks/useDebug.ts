import { message } from 'antd'
import { useMemoizedFn } from 'ahooks'
import i18next from 'i18next'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import resolveToString from '@/common/utils/template'
import { getAllPredecessors } from '@/MagicFlow/utils/reactflowUtils'
import { checkIsInGroup } from '@/MagicFlow/utils'
import { useNodeConfig, useNodeConfigActions } from '@/MagicFlow/context/FlowContext/useFlow'
import { useExternalConfig } from '@/MagicFlow/context/ExternalContext/useExternal'
import { useReactFlow } from 'reactflow'

type DebugProps = {
	id: string
}

export default function useDebug({ id }: DebugProps) {

    const { t } = useTranslation()

	const [isDebug, setIsDebug] = useState(false)

	const { allowDebug } = useExternalConfig()

    const { nodeConfig } = useNodeConfig()
    const { updateNodeConfig } = useNodeConfigActions()
    const { getNodes, getEdges } = useReactFlow()
    
	const currentNode = useMemo(() => {
		return nodeConfig[id]
	}, [nodeConfig, id])

	const checkHasPreNodeInDebug = useMemoizedFn(() => {
        
		if(!currentNode) return false
        const edges = getEdges()
        const nodes = getNodes()
		let predecessors = getAllPredecessors(currentNode, nodes, edges)
		
		// 如果是循环体内的节点，可引用的数据源为当前节点的上文节点+循环体的上文节点
		if (checkIsInGroup(currentNode)) {
			const loopBodyNode = nodeConfig?.[currentNode?.meta?.parent_id]
			const loopBodyAllPrevNodes = getAllPredecessors(loopBodyNode, nodes, edges)
			predecessors = [...loopBodyAllPrevNodes, ...predecessors]
		}
		// 是否有前置节点处于debug模式，如果有则将当前节点显性设置为debug模式
		const hasPreNodeDebug = predecessors.find(preNode => preNode.debug)
		return hasPreNodeDebug
	})

	useEffect(() => {
        const nodes = getNodes()
		// 通过节点是否已经挂载尺寸属性，判断是否reactflow渲染完毕
		if(!nodes?.[0]?.width) return
		const hasPreNodeDebug = checkHasPreNodeInDebug()
		if(hasPreNodeDebug) {
			setIsDebug(true)
		}else{
			// 当前节点是否处于debug模式
			setIsDebug(!!currentNode?.debug)
		}
	}, [nodeConfig])


	const onDebugChange = useMemoizedFn((debug: boolean) => {
		const hasPreNodeDebug = checkHasPreNodeInDebug()
		if(hasPreNodeDebug) {
			message.warning(resolveToString(i18next.t("flow.hasBeforeNodeDebugTips", { ns: "magicFlow" }), { name: hasPreNodeDebug.name }))
			return
		}
		updateNodeConfig({
			...currentNode,
			debug
		})
	})


	return {
		isDebug,
		onDebugChange,
		allowDebug
	}
}
