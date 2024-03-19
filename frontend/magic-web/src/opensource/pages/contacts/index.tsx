import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import { RouteName } from "@/opensource/routes/constants"
import { history } from "@/opensource/routes/history"

const ContactsMobilePage = lazy(() => import("../contactsMobile"))

function ContactsPage() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={null}>
				<ContactsMobilePage />
			</Suspense>
		)
	}

	history.push({
		name: RouteName.ContactsOrganization,
	})

	return null
}

export default ContactsPage
