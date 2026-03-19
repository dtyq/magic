import { useIsMobile } from "@/hooks/useIsMobile"
import ContactsMobile from "../../contactsMobile"
import { history } from "@/routes"
import { RouteName } from "@/routes/constants"

function Contacts() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <ContactsMobile />
	}

	history.push({
		name: RouteName.ContactsOrganization,
	})
	// Desktop version uses ContactsLayout
	return null
}

export default Contacts
