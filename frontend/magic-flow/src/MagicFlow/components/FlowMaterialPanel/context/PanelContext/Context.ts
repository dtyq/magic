import { AgentType } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import React from "react"

export type PanelCtx = React.PropsWithChildren<{
    agentType: AgentType
    setAgentType: React.Dispatch<React.SetStateAction<AgentType>>
}>  

export const PanelContext = React.createContext({
} as PanelCtx)
