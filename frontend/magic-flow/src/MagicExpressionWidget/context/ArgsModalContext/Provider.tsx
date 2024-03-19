import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import { ArgsModalContext, ArgsModalContextType } from "./Context"

export const ArgsModalProvider = ({
	isOpenArgsModal,
	openArgsModal,
	closeArgsModal,
	onConfirm,
	onPopoverModalClick,
	children,
}: PropsWithChildren<ArgsModalContextType>) => {
	const value = useMemo(() => {
		return {
			isOpenArgsModal,
			openArgsModal,
			closeArgsModal,
			onConfirm,
			onPopoverModalClick,
		}
	}, [isOpenArgsModal, openArgsModal, closeArgsModal, onConfirm, onPopoverModalClick])

	return <ArgsModalContext.Provider value={value}>{children}</ArgsModalContext.Provider>
}
