import { useEffect } from "react"
import { RouteName } from "@/routes/constants"
import { history } from "@/routes/history"

/** Replaces legacy mobile-tabs home with /mobile-home and drops transitional tab query. */
export function LegacyMobileHomeRedirect() {
	useEffect(() => {
		history.replace({ name: RouteName.MobileHome })
	}, [])

	return null
}
