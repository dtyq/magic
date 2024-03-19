import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import ContactsMobile from "../../contactsMobile"
import { history } from "@/opensource/routes"
import { RouteName } from "@/opensource/routes/constants"

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
