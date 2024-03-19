/* eslint-disable no-unused-vars */
import { EXPRESSION_ITEM, InputExpressionValue } from "@/MagicExpressionWidget/types"
import React from "react"

export type ArgsModalContextType = {
	isOpenArgsModal: boolean
	openArgsModal: () => void
	closeArgsModal: () => void
	onConfirm: () => void
	onPopoverModalClick: (
		e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
		item: EXPRESSION_ITEM,
		arg: InputExpressionValue,
		index: number,
	) => void
}

export const ArgsModalContext = React.createContext({
	isOpenArgsModal: false,
	openArgsModal: () => {},
	closeArgsModal: () => {},
	onConfirm: () => {},
	onPopoverModalClick: () => {},
} as ArgsModalContextType)
