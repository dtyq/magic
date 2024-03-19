import React from "react"
import { GlobalContext } from "./Context"

export const useGlobalContext = () => {
	return React.useContext(GlobalContext)
}
