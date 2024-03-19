import React from "react"
import { PanelContext } from "./Context"

export const usePanel = () => {
	return React.useContext(PanelContext)
}
