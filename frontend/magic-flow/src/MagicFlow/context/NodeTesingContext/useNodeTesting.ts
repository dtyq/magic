import React from "react"
import { NodeTestingContext } from "./Context"

export const useNodeTesting = () => {
	return React.useContext(NodeTestingContext)
}
