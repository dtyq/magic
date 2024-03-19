import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import { useFlowNodes } from "@/MagicFlow/context/FlowContext/useFlow"
import { judgeIsLoopBody } from "@/MagicFlow/utils"
import { useMemoizedFn } from "ahooks"
import useLoopBodyClick from "./useLoopBodyClick"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"
import { useEffect } from "react"

export default function useNodeClick() {
	const { setSelectedNodeId, selectedNodeId } = useFlowNodes()

	const { paramsName } = useExternalConfig()

	const { elevateBodyEdgesLevel, resetEdgesLevels } = useLoopBodyClick()

	const onNodeClick = useMemoizedFn((event, node) => {
		// console.log("NODE", node)
		event.stopPropagation()
		setSelectedNodeId(node.id)
		flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, node.id)

		// 处理点击循环体的逻辑
		if (judgeIsLoopBody(node[paramsName.nodeType])) {
			// 需要手动提升循环体内边的层级
			elevateBodyEdgesLevel(node)
		} else {
			resetEdgesLevels(node)
		}
	})

	const onPanelClick = useMemoizedFn(() => {
		flowEventBus.emit(FLOW_EVENTS.CANVAS_CLICKED)
		flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, null)
	})

	useEffect(() => {
		const cleanup = flowEventBus.on(FLOW_EVENTS.NODE_SELECTED, (e: CustomEvent) => {
			if (e.detail !== selectedNodeId) {
				setSelectedNodeId(e.detail)
			}
		})
		return () => {
			cleanup()
		}
	}, [])
	return {
		onNodeClick,
		onPanelClick,
	}
}
