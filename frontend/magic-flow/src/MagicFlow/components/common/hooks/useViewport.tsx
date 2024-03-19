import { useFlowUI, useNodeConfig } from "@/MagicFlow/context/FlowContext/useFlow"
import { useResize } from "@/MagicFlow/context/ResizeContext/useResize"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import { useReactFlow } from "reactflow"
import { controlDuration } from "../../FlowDesign/hooks/useFlowControls"
import { MaterialPanelWidth } from "../../FlowMaterialPanel"

export default function useViewport() {
	const { nodeConfig } = useNodeConfig()
	const { showMaterialPanel } = useFlowUI()
	const { setViewport } = useReactFlow()

	const { windowSize } = useResize()

	// 更新当前viewport 指向目标节点中心
	const updateViewPortToTargetNode = useMemoizedFn((currentNode) => {
		const materialPanelWidth = showMaterialPanel ? MaterialPanelWidth : 0

		const cloneCurrentNode = _.cloneDeep(currentNode)
		// 处理在循环体内新增节点时，position=循环体内position+循环体的position
		if (cloneCurrentNode?.meta?.parent_id) {
			const parentLoopBodyNode = nodeConfig?.[cloneCurrentNode?.meta?.parent_id]
			if (parentLoopBodyNode) {
				cloneCurrentNode.position = {
					x: cloneCurrentNode?.position.x + parentLoopBodyNode?.position?.x,
					y: cloneCurrentNode?.position.y + parentLoopBodyNode?.position?.y,
				}
			}
		}

		console.log(
			-cloneCurrentNode?.position?.x -
				cloneCurrentNode?.width / 2 +
				(windowSize.width - materialPanelWidth) / 2,
			cloneCurrentNode,
			windowSize,
		)

		// 定位到校验失败的节点
		setViewport(
			{
				x:
					-cloneCurrentNode?.position?.x -
					cloneCurrentNode?.width / 2 +
					(windowSize.width - materialPanelWidth) / 2,
				y:
					-cloneCurrentNode?.position?.y -
					cloneCurrentNode?.height / 2 +
					windowSize.height / 2,
				zoom: 1,
			},
			{
				duration: controlDuration,
			},
		)
	})

	return {
		updateViewPortToTargetNode,
	}
}
