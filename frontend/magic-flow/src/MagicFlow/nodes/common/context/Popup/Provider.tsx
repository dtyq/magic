import React, { useMemo } from "react"
import { PopupContext, PopupCtx } from "./Context"

export const PopupProvider = ({ closePopup, children }: PopupCtx) => {
	const value = useMemo(() => {
		return {
			closePopup,
		}
	}, [closePopup])

	return <PopupContext.Provider value={value}>{children}</PopupContext.Provider>
}
