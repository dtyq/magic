import { BaseDropdownOption } from "@/common/BaseUI/DropdownRenderer/Base";
import React from "react"

export type ToolOptionsCtx = React.PropsWithChildren<{
	tools: BaseDropdownOption[]
}>  

export const ToolOptionsContext = React.createContext({
    tools: [],
} as ToolOptionsCtx)

export default null
