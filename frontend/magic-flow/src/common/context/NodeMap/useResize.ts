import React from "react"
import { NodeMapContext } from "./Context"

export const useNodeMap = () => {
	return React.useContext(NodeMapContext)
}
