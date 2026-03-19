import { useContext } from "react"
import { ContactPageDataContext } from "./context"

export const useContactPageDataContext = () => {
	return useContext(ContactPageDataContext)
}
