import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { IconBug } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import React from "react"

export default function DebuggerToolbar() {
	const { nodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const toolbarFunc = useMemoizedFn(() => {
		console.log("调试", nodeConfig, currentNode)
	})

	return <IconBug stroke={1} onClick={toolbarFunc} />
}
