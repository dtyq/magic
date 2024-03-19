import React from "react"
import { CurrentNodeContext } from "./Context"

export const useCurrentNode = () => {
	return React.useContext(CurrentNodeContext)
}
