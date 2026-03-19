import { useMemo } from "react"
import { useMemoizedFn, useResetState, useUpdateEffect } from "ahooks"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { NodeTestingProvider } from "@dtyq/magic-flow/dist/MagicFlow/context/NodeTesingContext/Provider"
import { pick } from "lodash-es"
import { getNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import { FlowApi } from "@/apis"
import type { CustomFlowCtx } from "./Context"
import { CustomFlowContext } from "./Context"
import { customNodeType } from "../../constants"
import { shadowNode } from "../../utils/helpers"

export const CustomFlowProvider = ({ children, testFlowResult, setCurrentFlow }: CustomFlowCtx) => {
	const [testingConfig, setTestingConfig, resetTestingConfig] = useResetState({
		nowTestingNodeIds: [] as string[],
		testingNodeIds: [] as string[],
		testingResultMap: {},
		position: false,
	})

	useUpdateEffect(() => {
		if (!testFlowResult) return
		setTestingConfig({
			nowTestingNodeIds: [],
			testingNodeIds: Object.keys(testFlowResult),
			testingResultMap: testFlowResult,
			position: true,
		})
	}, [testFlowResult])

	const testNode = useMemoizedFn(
		async (node: MagicFlow.Node, dataSource: Record<string, any>) => {
			if (`${node.node_type}` === customNodeType.Code) {
				node = shadowNode(node)
			}
			const testNodeParams = pick(node, ["params", "node_type", "input", "output"])
			testingConfig.testingNodeIds = [node?.node_id]
			setTestingConfig({
				...testingConfig,
				nowTestingNodeIds: [node?.node_id],
			})
			try {
				const testResult = await FlowApi.testNode({
					...testNodeParams,
					node_version: getNodeVersion(node),
					trigger_config: {
						node_contexts: dataSource.trigger_data_form,
						global_variable: dataSource.global_variable,
					},
					...(dataSource.debug_data
						? {
							node_contexts: JSON.parse(dataSource.debug_data),
						}
						: {}),
				})
				setTestingConfig({
					...testingConfig,
					nowTestingNodeIds: [],
					testingResultMap: {
						...testingConfig.testingResultMap,
						[node?.node_id]: {
							...testResult,
						},
					},
					position: false,
				})
			} catch (err) {
				resetTestingConfig()
			}
		},
	)

	const value = useMemo(() => {
		return {
			testNode,
			resetTestingConfig,
			testingConfig,
			setCurrentFlow,
		}
	}, [testNode, resetTestingConfig, testingConfig, setCurrentFlow])

	return (
		// @ts-ignore
		<CustomFlowContext.Provider value={value}>
			<NodeTestingProvider {...testingConfig}>{children}</NodeTestingProvider>
		</CustomFlowContext.Provider>
	)
}

export default null
