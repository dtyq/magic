import React from "react"

export type PopupCtx = React.PropsWithChildren<{
    closePopup: () => void
}>  

export const PopupContext = React.createContext({
	closePopup: () => {}
} as PopupCtx)
