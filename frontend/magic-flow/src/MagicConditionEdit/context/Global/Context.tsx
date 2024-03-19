import React from "react"
import type { GlobalProviderProps } from "./Provider"

export const GlobalContext = React.createContext({
	leftDisabledPos: [] as string[],
	disabledOperationPos: [] as string[],
	showTitlePosList: [] as string[],
} as GlobalProviderProps)
