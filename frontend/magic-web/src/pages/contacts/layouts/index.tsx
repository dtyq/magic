import { Suspense } from "react"
import { Outlet } from "react-router"
import MagicSpin from "@/components/base/MagicSpin"
import ContactsSubSider from "../components/ContactsSubSider"
import ContactPageDataProvider from "../components/ContactDataProvider"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"

function ContactsLayout() {
	const isMobile = useIsMobile()
	const { t } = useTranslation("interface")

	if (isMobile) {
		return (
			<Suspense fallback={null}>
				<ContactPageDataProvider>
					<Outlet />
				</ContactPageDataProvider>
			</Suspense>
		)
	}

	return (
		<ContactPageDataProvider>
			<div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border">
				<div className="h-[42px] shrink-0 border-b border-border bg-background px-5 py-[9px] text-[18px] font-semibold leading-6 text-foreground/80">
					{t("contacts.topBar.title")}
				</div>
				<div className="flex h-[calc(100%-42px)] min-h-0 w-full flex-1">
					<ContactsSubSider />
					<div className="flex min-w-0 flex-1">
						<Suspense fallback={<MagicSpin />}>
							<Outlet />
						</Suspense>
					</div>
				</div>
			</div>
		</ContactPageDataProvider>
	)
}

export default ContactsLayout
