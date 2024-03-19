import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { lazy, Suspense } from "react"
import ContactsAiAssistantMobileSkeleton from "./skeleton/ContactsAiAssistantMobileSkeleton"

const ContactsAiAssistantMobile = lazy(() => import("@/opensource/pages/contacts/aiAssistant"))

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
	return null
}

export default ContactsAiAssistant
