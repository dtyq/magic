import React from "react"
import { ResizeContext } from "./Context"

export const useResize = () => {
	return React.useContext(ResizeContext)
}
