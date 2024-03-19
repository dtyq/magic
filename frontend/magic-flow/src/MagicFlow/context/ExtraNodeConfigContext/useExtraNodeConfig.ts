import React from "react"
import { ExtraNodeConfigContext } from "./Context"

export const useExtraNodeConfig = () => {
	return React.useContext(ExtraNodeConfigContext)
}
