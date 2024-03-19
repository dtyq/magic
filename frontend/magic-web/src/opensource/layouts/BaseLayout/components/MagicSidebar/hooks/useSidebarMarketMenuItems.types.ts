import type { LucideIcon } from "lucide-react"
import { RouteName } from "@/opensource/routes/constants"

export interface SidebarMarketMenuItem {
	titleKey: string
	routeName: RouteName
	testId: string
	Icon: LucideIcon
}
