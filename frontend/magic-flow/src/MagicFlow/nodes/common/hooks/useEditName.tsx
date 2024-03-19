import { useNodeConfig, useNodeConfigActions } from "@/MagicFlow/context/FlowContext/useFlow"
import { useMemoizedFn } from "ahooks"
import { useState } from "react"

type UseEditName = {
	id: string
}

export default function useEditName({ id }: UseEditName) {
	const [isEdit, setIsEdit] = useState(false)

	const { nodeConfig } = useNodeConfig()
	const { updateNodeConfig } = useNodeConfigActions()

	const onChangeName = useMemoizedFn((newName: string) => {
		setIsEdit(false)
		const node = nodeConfig[id]

		const resultData = {
			...node,
			name: newName,
		}

		updateNodeConfig(resultData)
	})

	return {
		isEdit,
		setIsEdit,
		onChangeName,
	}
}
