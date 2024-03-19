import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import type { ToolSelectedItem } from "../../../types"

type ContextProps = {
	keyword: string
	onAddTool: (tool: ToolSelectedItem) => void
}

const ToolsPanelContext = React.createContext({
	keyword: "",
} as ContextProps)

export const ToolsPanelProvider = ({
	children,
	keyword,
	onAddTool,
}: PropsWithChildren<ContextProps>) => {
	const value = useMemo(() => {
		return {
			keyword,
			onAddTool,
		}
	}, [keyword, onAddTool])

	return <ToolsPanelContext.Provider value={value}>{children}</ToolsPanelContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToolsPanel = () => {
	return React.useContext(ToolsPanelContext)
}
