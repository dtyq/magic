import { lazy } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import Navigate from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"

const AppsPageMobile = lazy(() => import("./index.mobile"))

/**
 * Apps route lives under the mobile shell; desktop viewport returns to /super for cache restore.
 */
export default function AppsPage() {
	const isMobile = useIsMobile()

	if (!isMobile) {
		return <Navigate name={RouteName.Super} replace viewTransition={false} />
	}

	return <AppsPageMobile />
}
