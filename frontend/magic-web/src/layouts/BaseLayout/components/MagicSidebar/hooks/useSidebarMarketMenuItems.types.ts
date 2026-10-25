import type { LucideIcon } from "lucide-react"
import { RouteName } from "@/routes/constants"

export interface SidebarMarketMenuItem {
	titleKey: string
	routeName: RouteName
	/** Routes that belong to this sidebar entry and should keep it selected. */
	activeRouteNames?: RouteName[]
	testId: string
	Icon: LucideIcon
}
