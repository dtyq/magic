import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ContactsMyGroupsMobileSkeleton from "./skeleton/ContactsMyGroupsMobileSkeleton"

const ContactsMyGroupsMobile = lazy(() => import("@/pages/contacts/myGroups"))

function ContactsMyGroups() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ContactsMyGroupsMobileSkeleton />}>
				<ContactsMyGroupsMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return null
}

export default ContactsMyGroups
