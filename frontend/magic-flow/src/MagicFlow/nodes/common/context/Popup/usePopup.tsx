import React from "react"
import { PopupContext } from "./Context"

export const usePopup = () => {
	return React.useContext(PopupContext)
}
