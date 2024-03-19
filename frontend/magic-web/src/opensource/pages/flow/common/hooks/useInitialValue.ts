import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemo } from "react"
import { getNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import { get } from "lodash-es"
import type { customNodeType } from "../../constants"
import { nodeComponentVersionMap } from "../../nodes"

type InitialValueProps = {
	nodeType: customNodeType
}

export default function useInitialValue({ nodeType }: InitialValueProps) {
	const { currentNode } = useCurrentNode()

	const initialValues = useMemo(() => {
		if (!currentNode) return null
		const nodeVersion = getNodeVersion(currentNode)
		const params = get(
			nodeComponentVersionMap,
			[nodeType, nodeVersion, "template", "params"],
			{},
		)
		return {
			...params,
			...currentNode?.params,
		}
	}, [currentNode, nodeType])

	return {
		initialValues,
	}
}
