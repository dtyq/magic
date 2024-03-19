import React from "react"
import { NodesContext, NodesStateContext, NodesActionContext, NodesCtx } from "./Context"

export function NodesProvider({ nodes, setNodes, onNodesChange, children }: NodesCtx) {
	// 分别创建状态和动作的Context值
	const stateValue = React.useMemo(
		() => ({
			nodes,
		}),
		[nodes],
	)

	const actionValue = React.useMemo(
		() => ({
			setNodes,
			onNodesChange,
		}),
		[setNodes, onNodesChange],
	)

	// 为了向后兼容而创建的完整Context值
	const contextValue = React.useMemo(
		() => ({
			...stateValue,
			...actionValue,
		}),
		[stateValue, actionValue],
	)

	return (
		<NodesStateContext.Provider value={stateValue}>
			<NodesActionContext.Provider value={actionValue}>
				<NodesContext.Provider value={contextValue}>{children}</NodesContext.Provider>
			</NodesActionContext.Provider>
		</NodesStateContext.Provider>
	)
}
