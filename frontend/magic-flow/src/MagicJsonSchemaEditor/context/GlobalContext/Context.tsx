import { NodeBaseInfo } from "@/MagicExpressionWidget/types"
import React from "react"
import { AppendPosition, ShowColumns } from "../../constants"
import { Common } from "../../types/Common"
import type { GlobalContextProviderProps } from "./Provider"

export const GlobalContext = React.createContext({
	allowOperation: false,
	disableFields: [] as string[],
	relativeAppendPosition: AppendPosition.Tail,
	innerExpressionSourceMap: {} as Record<string, Common.Options>,
	allowSourceInjectBySelf: true,
	nodeMap: {} as Record<string, NodeBaseInfo>,
	displayColumns: [],
	columnNames: {} as Record<ShowColumns, string>,
} as GlobalContextProviderProps)
