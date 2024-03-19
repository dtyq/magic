/**
 * 框选相关的状态
 */
import { MagicFlow } from '@/MagicFlow/types/flow'
import { copyToClipboard } from '@/MagicFlow/utils'
import { calculateMidpoint } from '@/MagicFlow/utils/reactflowUtils'
import { useMemoizedFn, useUpdate, useUpdateEffect } from 'ahooks'
import { message } from 'antd'
import { useEffect, useState } from 'react'
import { Edge, useKeyPress, useStoreApi } from 'reactflow'
import { useTranslation } from 'react-i18next'
import i18next from 'i18next'

type UseSelectionsProps = {
    flowInstance: any
}

export default function useSelections({ flowInstance }:UseSelectionsProps) {

    const { t } = useTranslation()

	// 是否显示框选工具
	const [showSelectionTools, setShowSelectionTools] = useState(false)

	// 被框选节点
	const [selectionNodes, setSelectionNodes] = useState([] as MagicFlow.Node[])

	// 被框选的边
	const [selectionEdges, setSelectionEdges] = useState([] as Edge[])

	useUpdateEffect(() => {
		// console.log("selectionNodes",selectionNodes, selectionEdges)
	}, [selectionNodes])

	const [selectionCenter, setSelectionCenter] = useState({
		left: "0",
		top: "0"
	})

	/** 选区变更事件 */
	const onSelectionChange = useMemoizedFn(({ nodes, edges }: any) => {
		// console.log(nodes, edges)
		setSelectionNodes(nodes)
		setSelectionEdges(edges)
	})

	
	/** 选区截止事件 */
	const onSelectionEnd = useMemoizedFn(() => {
		const center = calculateMidpoint(selectionNodes)
		setSelectionCenter({
			left: `${center.x}px`,
			top: `${center.y}px`
		})

		setShowSelectionTools(selectionNodes.length > 1)
	})

	useUpdateEffect(() => {
		if(selectionNodes.length === 0) {
			setShowSelectionTools(false)
		}
	}, [selectionNodes])


	const { getState } = useStoreApi()

	const store = getState()

	const onCopy = useMemoizedFn(() => {
        if(!selectionNodes.length) return
		copyToClipboard(
			JSON.stringify({
				nodes: selectionNodes,
				edges: selectionEdges,
			}),
		)

		message.success(i18next.t("common.copySuccess", { ns: "magicFlow" }))   

		/** 清除当前选框 */
		store.unselectNodesAndEdges()
	})

    

	// useEffect(() => {
	// 	const target = flowInstance.current
	// 	if (target) {
	// 		target.addEventListener("copy", onCopy, { capture: true })
	// 	}

	// 	return () => {
	// 		if (target) {
	// 			target.removeEventListener("copy", onCopy)
	// 		}
	// 	}
	// }, [flowInstance])


	return {
		showSelectionTools,
		setShowSelectionTools,
		selectionNodes,
		setSelectionNodes,
		selectionEdges,
		setSelectionEdges,
		onSelectionChange,
		onSelectionEnd,
		selectionCenter,
        onCopy
	}
}
