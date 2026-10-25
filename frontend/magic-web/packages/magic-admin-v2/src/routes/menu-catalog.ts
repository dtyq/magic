import type { LucideIcon } from "lucide-react"
import type { RouteGroupId, RouteSectionId } from "@magic-admin-v2/constants/routes"

export type MenuCatalogItem = {
	titleKey: string
	testId: string
	icon: LucideIcon
	linkOnly?: boolean
}

export type EditionMenuCatalog = {
	sectionCatalog: Partial<Record<RouteSectionId, MenuCatalogItem>>
	groupCatalog: Partial<Record<RouteGroupId, MenuCatalogItem>>
	routeIcons: Record<string, LucideIcon>
	sectionOrder: readonly RouteSectionId[]
	groupOrderBeforeAgents: readonly RouteGroupId[]
	groupOrderAfterModels: readonly RouteGroupId[]
	routeOrderAfterAppMenu: readonly string[]
	routeOrderAfterProviders: readonly string[]
}
