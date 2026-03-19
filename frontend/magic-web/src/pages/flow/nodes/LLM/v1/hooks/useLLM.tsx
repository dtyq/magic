import { useEffect, useMemo } from "react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { cloneDeep, isNull } from "lodash-es"
import useOldToolsHandle from "./useOldToolsHandle"
import { v1Template } from "../template"
import { useFlowStore } from "@/stores/flow"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"

export default function useLLMV0() {
	const { currentNode } = useCurrentNode()
	const { updateNodeConfig } = useNodeConfigActions()

	const { handleOldTools } = useOldToolsHandle()

	const { models } = useFlowStore()

	useEffect(() => {
		if (!currentNode || !models || models.length === 0) return

		// 检查当前节点的model是否为空
		const currentModel = currentNode?.params?.model
		if (!currentModel && models[0]?.value) {
			// 设置默认model到节点配置中
			const updatedNode = {
				...currentNode,
				params: {
					...currentNode.params,
					model: models[0].value,
				},
			}
			updateNodeConfig(updatedNode)
		}
	}, [currentNode, models, updateNodeConfig])

	const initialValues = useMemo(() => {
		let nodeParams = {
			...cloneDeep(v1Template.params),
			...(currentNode?.params || {}),
			model: currentNode?.params?.model || models?.[0]?.value || "",
		}

		// @ts-ignore
		nodeParams = handleOldTools(nodeParams)
		return {
			...nodeParams,
			model_config: {
				...v1Template.params.model_config,
				...nodeParams.model_config,
				vision: nodeParams.model_config?.vision || false,
				vision_model: nodeParams.model_config?.vision_model || "",
			},
			messages: isNull(nodeParams?.messages)
				? v1Template.params.messages
				: nodeParams?.messages,
		}
	}, [currentNode?.params, handleOldTools])

	// console.log(currentNode, initialValues)

	return {
		initialValues,
	}
}
