import { RouteName } from "@/routes/constants"

/**
 * MobileHome uses agentCode as a shareable and refresh-safe source of truth for
 * the homepage-selected employee, so we must keep it in the URL after resolving.
 * The legacy mobile-tabs homepage can continue clearing it to avoid carrying
 * transitional query state across that compatibility route.
 */
export function shouldClearResolvedAgentCodeFromUrl(routeName: RouteName): boolean {
	return routeName !== RouteName.MobileHome
}
