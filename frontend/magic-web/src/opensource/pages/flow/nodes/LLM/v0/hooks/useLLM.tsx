import { useMemo } from "react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { customNodeType } from "@/opensource/pages/flow/constants"
import { cloneDeep, isNull } from "lodash-es"
import useOldToolsHandle from "./useOldToolsHandle"
import { v0Template } from "../template"

export default function useLLMV0() {
	const { currentNode } = useCurrentNode()

	const { handleOldTools } = useOldToolsHandle()

	const initialValues = useMemo(() => {
		let nodeParams = {
			...cloneDeep(v0Template.params),
			...(currentNode?.params || {}),
		}

		// @ts-ignore
		nodeParams = handleOldTools(nodeParams)
		return {
			...nodeParams,
			model_config: {
				...v0Template.params.model_config,
				...nodeParams.model_config,
			},
			messages: isNull(nodeParams?.messages)
				? v0Template.params.messages
				: nodeParams?.messages,
		}
	}, [currentNode?.params, handleOldTools])

	// console.log(currentNode, initialValues)

	return {
		initialValues,
	}
}
