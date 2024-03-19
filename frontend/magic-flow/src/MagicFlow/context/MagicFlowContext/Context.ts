import { createStore } from "@/MagicFlow/store"
import React from "react"

export type MagicFlowCtx = React.PropsWithChildren<ReturnType<typeof createStore> | null>  

export const MagicFlowContext = React.createContext({
} as MagicFlowCtx)
