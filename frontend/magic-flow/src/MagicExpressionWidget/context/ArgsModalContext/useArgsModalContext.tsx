import React from "react"
import { ArgsModalContext } from "./Context"

export const useArgsModalContext = () => {
	return React.useContext(ArgsModalContext)
}
