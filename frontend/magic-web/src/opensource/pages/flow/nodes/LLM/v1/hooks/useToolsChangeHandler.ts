import type { ToolSelectedItem } from "@/opensource/pages/flow/components/ToolsSelect/types"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import { set, map, merge } from "lodash-es"

export default function useToolsChangeHandlerV0() {
	const { currentNode } = useCurrentNode()

	const { updateNodeConfig } = useNodeConfigActions()

	// 处理工具变更
	const handleToolsChanged = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		const oldTools = currentNode?.params?.option_tools || []
		const newToolIds = changeValues?.option_tools
			?.map?.((tool: ToolSelectedItem) => tool.tool_id)
			?.filter?.((tool: string) => !!tool)
		const isToolsEmpty = changeValues.option_tools.length === 0
		// (存在id 或者 列表为空)时，说明是新增或者删除，而不是修改，则走新增或者删除路径
		if (newToolIds.length > 0 || isToolsEmpty) {
			set(currentNode, ["params", "option_tools"], changeValues.option_tools)
		} else {
			const mergedTools = map(oldTools, (oldToolItem, index) => {
				return merge({}, oldToolItem, { ...changeValues?.option_tools?.[index] })
			})
			set(currentNode, ["params", "option_tools"], mergedTools)
		}
		// 触发重新渲染
		updateNodeConfig(currentNode)
	})

	return {
		handleToolsChanged,
	}
}
