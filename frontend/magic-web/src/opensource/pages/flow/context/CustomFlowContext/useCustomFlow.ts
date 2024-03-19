import React from "react"
import { CustomFlowContext } from "./Context"

export const useCustomFlow = () => {
	return React.useContext(CustomFlowContext)
}

export default {}
