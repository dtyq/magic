import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import type { MCPSelectedItem } from "../../../types"

type ContextProps = {
	keyword: string
	onAddMCP: (mcp: MCPSelectedItem) => void
}

const MCPPanelContext = React.createContext({
	keyword: "",
} as ContextProps)

export const MCPPanelProvider = ({
	children,
	keyword,
	onAddMCP,
}: PropsWithChildren<ContextProps>) => {
	const value = useMemo(() => {
		return {
			keyword,
			onAddMCP,
		}
	}, [keyword, onAddMCP])

	return <MCPPanelContext.Provider value={value}>{children}</MCPPanelContext.Provider>
}

export const useMCPPanel = () => {
	return React.useContext(MCPPanelContext)
}
