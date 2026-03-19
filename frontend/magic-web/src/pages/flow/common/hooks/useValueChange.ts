import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import { set } from "lodash-es"

export default function useValueChange() {
	const { currentNode } = useCurrentNode()
	const { updateNodeConfig } = useNodeConfigActions()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			set(currentNode, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNode,
		})
	})

	return {
		onValuesChange,
	}
}
