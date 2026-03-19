import { useFlowStore } from "@/stores/flow"
import { transformDataSource } from "@dtyq/magic-flow/dist/MagicExpressionWidget/helpers"
import { FlowType } from "@/types/flow"
import { useMemoizedFn, useMount } from "ahooks"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { useEffect } from "react"
import { FlowApi } from "@/apis"
import { customNodeType } from "../constants"
import type { ToolSelectedItem } from "../components/ToolsSelect/types"

type UseDataInitProps = {
	currentFlow?: MagicFlow.Flow
}

/**
 * 初次加载流程就需要初始化的数据
 */
export default function useDataInit({ currentFlow }: UseDataInitProps) {
	const {
		updateUseableToolSets,
		updateModels,
		updateUseableDatabases,
		updateSubFlowList,
		updateMethodDataSource,
		updateToolInputOutputMap,
		updateUseableMCPs,
	} = useFlowStore()

	const initMethodsDataSource = useMemoizedFn(async () => {
		const { expression_data_source } = await FlowApi.getMethodsDataSource()
		// 将数据源进一步转换为流程可识别的数据源结构
		const methodsOptions = transformDataSource(expression_data_source)
		updateMethodDataSource(methodsOptions)
	})

	const initSubFlows = useMemoizedFn(async () => {
		const subFlowResponse = await FlowApi.getFlowList({ type: FlowType.Sub })

		if (subFlowResponse.list) {
			updateSubFlowList(subFlowResponse.list)
		}
	})

	const initUseableToolSets = useMemoizedFn(async () => {
		try {
			const response = await FlowApi.getUseableToolList()
			console.log("FlowApi.getUseableToolList()", response)
			if (response && response.list) {
				updateUseableToolSets(response.list)
			}
		} catch (e) {
			console.log("initUseableToolSets error", e)
		}
	})

	const initUseableDatabases = useMemoizedFn(async () => {
		FlowApi.getUseableDatabaseList().then((response) => {
			if (response && response.list) {
				updateUseableDatabases(response.list)
			}
		})
	})

	const initModels = useMemoizedFn(async () => {
		const { models } = await FlowApi.getLLMModal()
		updateModels(models)
	})

	// 初始化已配置的工具的相关模板
	const initToolInputOutputMap = useMemoizedFn(async () => {
		// 所有大模型节点配置的工具
		const llmNodeToolIds =
			currentFlow?.nodes
				?.filter?.((node) => node.node_type === customNodeType.LLM)
				?.reduce?.((ids, node) => {
					const optionTools = node?.params?.option_tools as ToolSelectedItem[]
					const currentNodeToolIds = optionTools?.map?.((tool) => tool.tool_id)
					return [...new Set([...ids, ...currentNodeToolIds])]
				}, [] as string[]) || []
		// 工具节点配置的工具
		const toolsNodeToolIds =
			currentFlow?.nodes
				?.filter?.((node) => node.node_type === customNodeType.Tools)
				?.reduce((ids, node) => {
					const toolId = node?.params?.tool_id as string
					return [...new Set([...ids, toolId])]
				}, [] as string[]) || []
		const flowToolIds = [...new Set([...llmNodeToolIds, ...toolsNodeToolIds])]
		if (flowToolIds.length > 0) {
			const response = await FlowApi.getAvailableTools(flowToolIds)
			if (response.list) {
				const map = response.list.reduce(
					(toolsMap, currentTool) => {
						if (!currentTool?.id) return toolsMap
						toolsMap[currentTool.id] = currentTool
						return toolsMap
					},
					{} as Record<string, MagicFlow.Flow>,
				)
				updateToolInputOutputMap(map)
			}
		}
	})

	const initUseableMCPs = useMemoizedFn(async () => {
		const response = await FlowApi.getUseableMCPList()
		if (response.list) {
			updateUseableMCPs(response.list)
		}
	})

	const initData = useMemoizedFn(async () => {
		initUseableToolSets()
		initModels()
		initUseableDatabases()
		initSubFlows()
		initMethodsDataSource()
		initUseableMCPs()
	})

	useMount(() => {
		initData()
	})

	useEffect(() => {
		if (currentFlow) {
			initToolInputOutputMap()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentFlow])
}
