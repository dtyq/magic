import type { PropsWithChildren } from "react"
import { useEffect, useMemo, useState } from "react"
import { ContactViewType } from "../../constants"
import { ContactPageDataContext } from "./context"
import { userStore } from "@/models/user"
import { observer } from "mobx-react-lite"
import { useLocation } from "react-router"

const ContactPageDataProvider = observer(function ContactPageDataProvider({
	children,
}: PropsWithChildren) {
	const { state } = useLocation()

	useEffect(() => {
		if (state?.departmentPath) {
			setCurrentDepartmentPath(state.departmentPath)
		}
	}, [state?.departmentPath])

	const [currentDepartmentPath, setCurrentDepartmentPath] = useState<
		{ id: string; name: string }[]
	>([])
	const [viewType, setViewType] = useState<ContactViewType>(ContactViewType.LIST)

	const organizationCode = userStore.user.organizationCode

	const value = useMemo(
		() => ({
			currentDepartmentPath,
			viewType,
			organizationCode,
			setCurrentDepartmentPath,
			setViewType,
		}),
		[currentDepartmentPath, organizationCode, viewType],
	)

	return (
		<ContactPageDataContext.Provider value={value}>{children}</ContactPageDataContext.Provider>
	)
})

export default ContactPageDataProvider
