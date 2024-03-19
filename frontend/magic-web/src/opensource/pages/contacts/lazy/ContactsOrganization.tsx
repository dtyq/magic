import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ContactsOrganizationMobileSkeleton from "./skeleton/ContactsOrganizationMobileSkeleton"

const ContactsOrganizationPage = lazy(() => import("../organization"))

function ContactsOrganization() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ContactsOrganizationMobileSkeleton />}>
				<ContactsOrganizationPage />
			</Suspense>
		)
	}

	// Desktop version handled by ContactsOrganizationPage itself
	return (
		<Suspense fallback={null}>
			<ContactsOrganizationPage />
		</Suspense>
	)
}

export default ContactsOrganization
