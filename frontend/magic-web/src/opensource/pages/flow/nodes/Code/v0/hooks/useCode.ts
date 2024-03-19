/**
 * 代码块相关的状态和方法
 */

import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import { cloneDeep, set } from "lodash-es"
import type { FormInstance } from "antd"
import { defaultCodeMap } from "../constants"

type UseCodeProps = {
	form: FormInstance<any>
}

export default function useCode({ form }: UseCodeProps) {
	const { currentNode } = useCurrentNode()

	const checkIsDefaultCode = useMemoizedFn(() => {
		const currentCode = currentNode?.params?.code || ""
		return Object.values(defaultCodeMap).some((defaultCode) => {
			return defaultCode === currentCode
		})
	})

	const updateCode = useMemoizedFn((language: string) => {
		if (!currentNode) return
		const newDefaultCode = cloneDeep(defaultCodeMap[language])
		set(currentNode, ["params", "code"], newDefaultCode)
		form.setFieldValue("code", newDefaultCode)
	})

	return {
		checkIsDefaultCode,
		updateCode,
	}
}
