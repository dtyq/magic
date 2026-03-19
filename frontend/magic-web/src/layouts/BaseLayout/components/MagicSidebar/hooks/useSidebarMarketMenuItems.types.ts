import type { LucideIcon } from "lucide-react"
import { RouteName } from "@/routes/constants"

export interface SidebarMarketMenuItem {
	titleKey: string
	routeName: RouteName
	testId: string
	Icon: LucideIcon
}
