import type { ToolSelectedItem } from "@/opensource/pages/flow/components/ToolsSelect/types"
import { useFlowStore } from "@/opensource/stores/flow"
import { useMemoizedFn } from "ahooks"
import { cloneDeep, set } from "lodash-es"
import type { UseableToolSet } from "@/opensource/types/flow"
import { ComponentTypes } from "@/opensource/types/flow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { genDefaultComponent } from "@/opensource/pages/flow/utils/helpers"

/**
 * 针对旧工具的处理
 */
export default function useOldToolsHandleV0() {
	const { currentNode } = useCurrentNode()
	// 获取所有可用的工具集
	const { useableToolSets } = useFlowStore()

	const findTargetToolSetByToolId = useMemoizedFn((toolId: string) => {
		return useableToolSets?.find?.((toolSet) => {
			return !!toolSet.tools?.find((t) => t.code === toolId)
		}) as UseableToolSet.Item
	})

	// 兼容旧数据处理方法
	const handleOldTools = useMemoizedFn(
		(params: Record<string, any>, oldKey = "tools", newKey = "option_tools") => {
			const cloneParams = cloneDeep(params)
			const oldTools = cloneParams?.[oldKey] || []
			const newTools = cloneParams[newKey] || []
			// 如果新工具列表为空，且旧工具列表不为空，则取旧工具列表的值作为新工具列表的值
			if (newTools?.length === 0 && oldTools?.length > 0) {
				cloneParams[newKey] = cloneParams?.[oldKey]?.map(
					(tool: string | ToolSelectedItem) => {
						if (typeof tool === "string") {
							return {
								tool_id: tool,
								tool_set_id: findTargetToolSetByToolId(tool)?.id,
								async: false,
								custom_system_input: {
									form: genDefaultComponent(ComponentTypes.Form),
									widget: null,
								},
							} as ToolSelectedItem
						}
						return tool
					},
				)
				if (currentNode) set(currentNode, ["params", "option_tools"], cloneParams[newKey])
			}
			return cloneParams
		},
	)

	return {
		handleOldTools,
	}
}
