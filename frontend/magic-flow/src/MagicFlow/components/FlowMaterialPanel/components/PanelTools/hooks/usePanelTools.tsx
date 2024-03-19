/**
 * 流程tab的数据
 */

import { useMaterialSource } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { nodeManager, NodeWidget } from "@/MagicFlow/register/node"
import { flowStore } from "@/MagicFlow/store"
import { getNodeSchema } from "@/MagicFlow/utils"
import { useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import { useStore } from "zustand"
import { TabObject } from "../../../constants"

export default function usePanelTools() {
	const { tools } = useMaterialSource()
	const { nodeVersionSchema } = useStore(flowStore, (state) => state)

	const schema = useMemo(() => {
		const flowNodeType = nodeManager?.materialNodeTypeMap?.[TabObject.Tools]
		if (!flowNodeType) return null
		return getNodeSchema(flowNodeType)
	}, [nodeVersionSchema])

	const getGroupListByToolSetId = useMemoizedFn((toolSetId: string) => {
		return tools?.groupList
			?.find?.((toolSet) => toolSet?.id === toolSetId)
			?.children?.map?.((tool) => {
				return {
					schema: {
						...schema,
						label: tool?.name,
						desc: tool?.description,
						avatar: tool?.avatar,
						isGroupNode: false,
						input: tool?.detail?.input,
						output: tool?.detail?.output,
						params: { tool_id: tool?.detail?.id },
						custom_system_input: tool?.detail?.custom_system_input,
					},
					component: () => null,
				} as NodeWidget
			})
	})


	return {
		schema,
		getGroupListByToolSetId,
	}
}
