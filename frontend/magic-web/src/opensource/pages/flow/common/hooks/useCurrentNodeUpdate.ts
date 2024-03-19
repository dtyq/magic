import type { FormInstance } from "antd"
import { useFlowData } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useUpdateEffect } from "ahooks"

type UseCurrentNodeUpdateProps = {
	form: FormInstance<any>
	initialValues?: any
}

export default function useCurrentNodeUpdate({ form }: UseCurrentNodeUpdateProps) {
	const { flow } = useFlowData()

	const { currentNode } = useCurrentNode()

	useUpdateEffect(() => {
		form.setFieldsValue({
			...currentNode?.params,
		})
	}, [flow, currentNode])
}
