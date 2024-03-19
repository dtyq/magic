import React from "react"
import { TextareaModeContext } from "./Context"

export const useTextareaModeContext = () => {
	return React.useContext(TextareaModeContext)
}
