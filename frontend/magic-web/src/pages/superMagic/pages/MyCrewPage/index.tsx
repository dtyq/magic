import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"

const MyCrewPageDesktop = lazy(() => import("./index.desktop"))
const MyCrewPageMobile = lazy(() => import("./index.mobile"))

export default function MyCrewPage() {
	const isMobile = useIsMobile()

	if (isMobile) return <MyCrewPageMobile />

	return <MyCrewPageDesktop />
}
