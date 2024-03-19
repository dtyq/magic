import { useContext } from "react"
import { GlobalContext } from "./Context"

export const useGlobal = () => {
	return useContext(GlobalContext)
}
