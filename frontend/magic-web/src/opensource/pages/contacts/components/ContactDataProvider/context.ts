import { createContext } from "react"
import { ContactViewType } from "../../constants"
import type { ContactPageDataContextValue } from "./types"

export const ContactPageDataContext = createContext<ContactPageDataContextValue>({
	currentDepartmentPath: [],
	viewType: ContactViewType.LIST,
	organizationCode: "",
	setCurrentDepartmentPath: () => {},
	setViewType: () => {},
})
