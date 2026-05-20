import type { PropsWithChildren } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import Navigate from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"

/**
 * Guards routes that only exist on desktop: mobile viewport is sent to mobile home.
 */
export function DesktopOnlyRoute({ children }: PropsWithChildren) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <Navigate name={RouteName.MobileHome} replace viewTransition={false} />
	}

	return children
}

/**
 * Guards routes that only exist under the mobile shell: desktop viewport opens /super for cache restore.
 */
export function MobileOnlyRoute({ children }: PropsWithChildren) {
	const isMobile = useIsMobile()

	if (!isMobile) {
		return <Navigate name={RouteName.Super} replace viewTransition={false} />
	}

	return children
}
