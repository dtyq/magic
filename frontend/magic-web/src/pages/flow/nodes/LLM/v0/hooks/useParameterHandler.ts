import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import { set } from "lodash-es"

export default function useParameterHandler() {
	const { currentNode } = useCurrentNode()

	const handleModelConfigChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		Object.entries(changeValues.model_config).forEach(([changeKey, changeValue]) => {
			set(currentNode, ["params", "model_config", changeKey], changeValue)
		})
	})

	return {
		handleModelConfigChange,
	}
}
