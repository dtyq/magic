import { useIsMobile } from "@/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ContactsAiAssistantMobileSkeleton from "./skeleton/ContactsAiAssistantMobileSkeleton"

const ContactsAiAssistantMobile = lazy(() => import("@/pages/contacts/aiAssistant"))

function ContactsAiAssistant() {
	const isMobile = useIsMobile()

	if (isMobile) {
		return (
			<Suspense fallback={<ContactsAiAssistantMobileSkeleton />}>
				<ContactsAiAssistantMobile />
			</Suspense>
		)
	}

	// Desktop version not implemented yet
	return <ContactsAiAssistantMobile />
}

export default ContactsAiAssistant
