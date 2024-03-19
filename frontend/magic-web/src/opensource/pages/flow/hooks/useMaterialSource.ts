import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { MaterialGroup } from "@dtyq/magic-flow/dist/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { useEffect, useMemo, useState } from "react"
import { useFlowStore } from "@/opensource/stores/flow"
import { cloneDeep } from "lodash-es"
import { useMemoizedFn } from "ahooks"
import { customNodeType } from "../constants"
import { v0Template } from "../nodes/SubFlow/v0/template"

export default function useMaterialSource() {
	const { subFlows, useableToolSets } = useFlowStore()

	const [subFlowList, setSubFlowList] = useState([] as MagicFlow.Flow[])

	const [toolGroup, setToolGroups] = useState([] as MaterialGroup[])

	useEffect(() => {
		setSubFlowList([...subFlows.filter((f) => f.enabled)])
	}, [subFlows])

	const subFlow = useMemo(() => {
		return {
			list: subFlowList,
			searchListFn: async (keyword: string) => {
				const list = subFlows
					.filter((flow) => flow.name?.includes?.(keyword) && flow.enabled)
					?.map((flow) => {
						return {
							...flow,
							input: v0Template.input,
							output: v0Template.output,
						}
					})
				// @ts-ignore
				setSubFlowList(cloneDeep(list))
			},
			getNextPageFn: async () => {},
		}
	}, [subFlowList, subFlows])

	const generateToolGroups = useMemoizedFn((keyword = "") => {
		// @ts-ignore
		const toolGroups = useableToolSets.reduce((groups, currentToolSet) => {
			const materialGroup = {
				groupName: currentToolSet.name,
				desc: currentToolSet.description,
				avatar: currentToolSet.icon,
				isGroupNode: true,
				id: currentToolSet.id,
				children: currentToolSet?.tools
					?.filter((tool) => tool.name.includes(keyword))
					?.map?.((tool) => {
						return {
							groupName: "",
							description: tool.description,
							avatar: currentToolSet.icon,
							isGroupNode: false,
							name: tool.name,
							detail: {
								id: tool.code,
								input: null,
								output: null,
							},
						}
					}),
			}
			const result = [...groups, materialGroup]
			return result
		}, [] as MaterialGroup[]) as MaterialGroup[]

		return toolGroups
	})

	useEffect(() => {
		setToolGroups(generateToolGroups(""))
	}, [generateToolGroups, useableToolSets])

	const tools = useMemo(() => {
		return {
			groupList: toolGroup,
			searchListFn: async (keyword: string) => {
				// @ts-ignore
				const list = generateToolGroups(keyword)
				// @ts-ignore
				setToolGroups(cloneDeep(list))
			},
			getNextPageFn: async () => {},
		}
	}, [generateToolGroups, toolGroup])

	return {
		subFlow,
		tools,
	}
}
