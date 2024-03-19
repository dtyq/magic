import React from "react"
import { FlowPopupContext } from "./Context"

export const useFlowPopup = () => {
	return React.useContext(FlowPopupContext)
}
