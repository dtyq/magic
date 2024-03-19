import { NodeGroup } from "@/MagicFlow/register/node"
import { MagicFlow } from "@/MagicFlow/types/flow"
import React, { useMemo } from "react"

// 物料分组
export type MaterialGroup = Partial<Omit<NodeGroup, "nodeTypes" | "children">> & {
	detail: Pick<MagicFlow.Node, "input" | "output" | "id" | "custom_system_input"> // 具体的节点配置
	name: string // 节点名称
	description: string // 节点描述
	avatar: string // 头像链接
	isGroupNode: boolean
	children: MaterialGroup[]
	id: string
}

export enum AgentType {
	Person = 0,
	Enterprise = 1,
	Market = 2,
}

export type MaterialSourceCtx = React.PropsWithChildren<{
	tools?: {
		groupList: MaterialGroup[]
		searchListFn: (keyword: string) => Promise<void>
		getNextPageFn: () => Promise<void>
	}
	subFlow?: {
		list: MagicFlow.Flow
		searchListFn: (keyword: string) => Promise<void>
		getNextPageFn: () => Promise<void>
	}
	agent?: {
		list: Partial<MagicFlow.Flow>
		searchListFn: (type: AgentType, keyword: string) => Promise<void>
		getNextPageFn: () => Promise<void>
	}
}>

export const MaterialSourceContext = React.createContext({} as MaterialSourceCtx)

export const MaterialSourceProvider = ({ tools, subFlow, agent, children }: MaterialSourceCtx) => {
	const value = useMemo(() => {
		return {
			tools,
			subFlow,
			agent,
		}
	}, [tools, subFlow, agent])

	return <MaterialSourceContext.Provider value={value}>{children}</MaterialSourceContext.Provider>
}

export const useMaterialSource = () => {
	return React.useContext(MaterialSourceContext)
}
