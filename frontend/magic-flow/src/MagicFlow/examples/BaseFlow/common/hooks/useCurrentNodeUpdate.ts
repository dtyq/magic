import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import type { FormInstance } from "antd"
import { useUpdateEffect } from "ahooks"
import _ from "lodash"

type UseCurrentNodeUpdateProps = {
	form: FormInstance<any>
	initialValues?: any
}

export default function useCurrentNodeUpdate({ form }: UseCurrentNodeUpdateProps) {
	const { flow } = useFlow()

	const { currentNode } = useCurrentNode()

	useUpdateEffect(() => {
        console.log(_.cloneDeep(currentNode?.params?.user_prompt?.structure?.expression_value?.[0]))
		form.setFieldsValue({
			...currentNode?.params,
		})
	}, [flow, currentNode])
}
