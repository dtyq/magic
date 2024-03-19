import { EXPRESSION_ITEM } from "@/MagicExpressionWidget/types"
import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import { TextareaModeContext } from "./Context"

export type TextareaModeContextProviderProps = {
	openSelectPanel: () => void
	closeSelectPanel: () => void
	withPopOver: (WrappedComponent: React.ReactNode, config: EXPRESSION_ITEM) => React.ReactNode
	handleDoubleClickNode: (node: EXPRESSION_ITEM) => void
	closeCurrentNodeEdit: () => void
}

export const TextareaModeProvider = ({
	openSelectPanel,
	closeSelectPanel,
	withPopOver,
	handleDoubleClickNode,
	closeCurrentNodeEdit,
	children,
}: PropsWithChildren<TextareaModeContextProviderProps>) => {
	const value = useMemo(() => {
		return {
			openSelectPanel,
			closeSelectPanel,
			withPopOver,
			handleDoubleClickNode,
			closeCurrentNodeEdit,
		}
	}, [
		openSelectPanel,
		closeSelectPanel,
		withPopOver,
		handleDoubleClickNode,
		closeCurrentNodeEdit,
	])

	return <TextareaModeContext.Provider value={value}>{children}</TextareaModeContext.Provider>
}
