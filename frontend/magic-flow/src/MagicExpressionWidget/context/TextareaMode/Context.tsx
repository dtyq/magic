/* eslint-disable no-unused-vars */
import { EXPRESSION_ITEM } from "@/MagicExpressionWidget/types"
import React from "react"
import type { TextareaModeContextProviderProps } from "./Provider"

export const TextareaModeContext = React.createContext({
	openSelectPanel: () => {},
	closeSelectPanel: () => {},
	withPopOver: (WrappedComponent: React.ReactNode, config: EXPRESSION_ITEM) => <div />,
	handleDoubleClickNode: (val: EXPRESSION_ITEM) => {},
	closeCurrentNodeEdit: () => {},
} as TextareaModeContextProviderProps)
