import {
	Activity,
	AppWindow,
	Bot,
	Boxes,
	BrainCircuit,
	Cable,
	ClipboardList,
	Cpu,
	Database,
	FileText,
	GaugeCircle,
	Info,
	ListChecks,
	MenuSquare,
	Presentation,
	Route as RouteIcon,
	SlidersHorizontal,
	Store,
	UserRoundCheck,
	type LucideIcon,
} from "lucide-react"
import type { AccessContext } from "@magic-admin-v2/runtime/types"
import {
	RouteGroup,
	type RouteGroupId,
	RouteName,
	RouteSection,
	type RouteSectionId,
} from "@magic-admin-v2/constants/routes"
import { editionMenuCatalog } from "@magic-admin-v2/routes/edition-menu"
import type { MenuCatalogItem } from "@magic-admin-v2/routes/menu-catalog"
import type { Route } from "@magic-admin-v2/routes/types"

export type NavigationItem = {
	titleKey: string
	testId: string
	href: string
	icon: LucideIcon
}

export type NavigationGroup = {
	id: RouteGroupId
	testId: string
	titleKey: string
	icon: LucideIcon
	href?: string
	items: NavigationItem[]
}

export type PrimaryNavigationItem = {
	id: RouteSectionId
	testId: string
	titleKey: string
	href: string
	icon: LucideIcon
	groups: NavigationGroup[]
}

export type NavigationMatch = {
	section: PrimaryNavigationItem
	group: NavigationGroup
	item?: NavigationItem
}

const sectionCatalog: Partial<Record<RouteSectionId, MenuCatalogItem>> = {
	[RouteSection.Platform]: {
		titleKey: "nav.primary.platform",
		testId: "dashboard-navigation-platform-section",
		icon: AppWindow,
	},
	...editionMenuCatalog.sectionCatalog,
	[RouteSection.Examples]: {
		titleKey: "nav.primary.examples",
		testId: "dashboard-navigation-examples-section",
		icon: RouteIcon,
	},
}

const groupCatalog: Partial<Record<RouteGroupId, MenuCatalogItem>> = {
	[RouteGroup.BasicSettings]: {
		titleKey: "nav.group.basicSettings",
		testId: "dashboard-navigation-basic-settings-group",
		icon: SlidersHorizontal,
	},
	[RouteGroup.AgentManagement]: {
		titleKey: "nav.group.agentManagement",
		testId: "dashboard-navigation-agent-management-group",
		icon: Bot,
	},
	[RouteGroup.ModelManagement]: {
		titleKey: "nav.group.modelManagement",
		testId: "dashboard-navigation-model-management-group",
		icon: BrainCircuit,
	},
	...editionMenuCatalog.groupCatalog,
	[RouteGroup.ExampleDashboard]: {
		titleKey: "nav.group.exampleDashboard",
		testId: "dashboard-navigation-example-dashboard-group",
		icon: GaugeCircle,
	},
	[RouteGroup.ExampleData]: {
		titleKey: "nav.group.exampleData",
		testId: "dashboard-navigation-example-data-group",
		icon: Database,
	},
	[RouteGroup.ExampleForms]: {
		titleKey: "nav.group.exampleForms",
		testId: "dashboard-navigation-example-forms-group",
		icon: ClipboardList,
	},
	[RouteGroup.ExampleSettings]: {
		titleKey: "nav.group.exampleSettings",
		testId: "dashboard-navigation-example-settings-group",
		icon: SlidersHorizontal,
	},
	[RouteGroup.ExampleDetails]: {
		titleKey: "nav.group.exampleDetails",
		testId: "dashboard-navigation-example-details-group",
		icon: FileText,
	},
	[RouteGroup.ExampleStates]: {
		titleKey: "nav.group.exampleStates",
		testId: "dashboard-navigation-example-states-group",
		icon: Activity,
	},
}

const routeIcons: Record<string, LucideIcon> = {
	[RouteName.PlatformInfo]: Info,
	[RouteName.PlatformAppMenu]: MenuSquare,
	[RouteName.PlatformModelList]: Boxes,
	[RouteName.PlatformProviderList]: Cable,
	[RouteName.PlatformSystemCapabilities]: Cpu,
	[RouteName.PlatformSlidesTemplate]: Presentation,
	[RouteName.PlatformOfficialStaff]: UserRoundCheck,
	[RouteName.PlatformOfficialMarketplace]: Store,
	[RouteName.PlatformPublishReview]: ListChecks,
	...editionMenuCatalog.routeIcons,
}

const sectionOrder: readonly RouteSectionId[] = [
	RouteSection.Platform,
	...editionMenuCatalog.sectionOrder,
	RouteSection.Examples,
]

const groupOrder: readonly RouteGroupId[] = [
	RouteGroup.BasicSettings,
	...editionMenuCatalog.groupOrderBeforeAgents,
	RouteGroup.AgentManagement,
	RouteGroup.ModelManagement,
	...editionMenuCatalog.groupOrderAfterModels,
	RouteGroup.ExampleDashboard,
	RouteGroup.ExampleData,
	RouteGroup.ExampleForms,
	RouteGroup.ExampleSettings,
	RouteGroup.ExampleDetails,
	RouteGroup.ExampleStates,
]

/**
 * 菜单项顺序以原型为基准，避免基础路由与企业路由的注册顺序影响最终侧边栏。
 */
const routeOrder: readonly string[] = [
	RouteName.PlatformInfo,
	RouteName.PlatformAppMenu,
	...editionMenuCatalog.routeOrderAfterAppMenu,
	RouteName.PlatformSystemCapabilities,
	RouteName.PlatformOfficialStaff,
	RouteName.PlatformOfficialMarketplace,
	RouteName.PlatformPublishReview,
	RouteName.PlatformSlidesTemplate,
	RouteName.PlatformModelList,
	RouteName.PlatformProviderList,
	...editionMenuCatalog.routeOrderAfterProviders,
	RouteName.ExamplesDashboard,
	RouteName.ExamplesList,
	RouteName.ExamplesCards,
	RouteName.ExamplesFormSingle,
	RouteName.ExamplesFormMulti,
	RouteName.ExamplesWizard,
	RouteName.ExamplesDialog,
	RouteName.ExamplesSettings,
	RouteName.ExamplesDetail,
	RouteName.ExamplesDetailEdit,
	RouteName.ExamplesSheet,
	RouteName.ExamplesEmpty,
]

const sectionOrderIndex = createOrderIndex(sectionOrder)
const groupOrderIndex = createOrderIndex(groupOrder)
const routeOrderIndex = createOrderIndex(routeOrder)

/**
 * Route metadata is the single source of menu membership. The explicit order
 * catalogs keep the sidebar aligned with the prototype across route bundles.
 */
export function createNavigation(
	routes: readonly Route[],
	access: AccessContext | null,
	basePath = "",
): PrimaryNavigationItem[] {
	if (!access) return []

	const sections: PrimaryNavigationItem[] = []
	const sectionMap = new Map<RouteSectionId, PrimaryNavigationItem>()
	const groupMap = new Map<string, NavigationGroup>()
	const orderedRoutes = flattenRoutes(routes).sort(compareNavigationRoutes)

	for (const route of orderedRoutes) {
		const sectionId = route.meta?.section
		const groupId = route.meta?.group
		if (!route.path || !route.titleKey || !sectionId || !groupId) continue
		if (route.validate && !route.validate(access)) continue
		if (!isMenuVisible(route, access)) continue

		const sectionDefinition = sectionCatalog[sectionId]
		const groupDefinition = groupCatalog[groupId]
		if (!sectionDefinition || !groupDefinition) continue

		const href = joinRoutePath(basePath, route.path)
		let section = sectionMap.get(sectionId)
		if (!section) {
			section = {
				id: sectionId,
				testId: sectionDefinition.testId,
				titleKey: sectionDefinition.titleKey,
				icon: sectionDefinition.icon,
				href,
				groups: [],
			}
			sectionMap.set(sectionId, section)
			sections.push(section)
		}

		const scopedGroupId = `${sectionId}:${groupId}`
		let group = groupMap.get(scopedGroupId)
		if (!group) {
			group = {
				id: groupId,
				testId: groupDefinition.testId,
				titleKey: groupDefinition.titleKey,
				icon: groupDefinition.icon,
				href: groupDefinition.linkOnly ? href : undefined,
				items: [],
			}
			groupMap.set(scopedGroupId, group)
			section.groups.push(group)
		}

		if (!groupDefinition.linkOnly) {
			group.items.push({
				testId: `dashboard-navigation-${route.name}-item`,
				titleKey: route.titleKey,
				href,
				icon: routeIcons[route.name] ?? FileText,
			})
		}
	}

	return sections
}

export function getDefaultNavigationHref(
	navigation: readonly PrimaryNavigationItem[],
): string | undefined {
	return navigation[0]?.href
}

function createOrderIndex<TItem>(items: readonly TItem[]) {
	return new Map(items.map((item, index) => [item, index]))
}

function compareNavigationRoutes(left: Route, right: Route) {
	return (
		getOrder(sectionOrderIndex, left.meta?.section) -
			getOrder(sectionOrderIndex, right.meta?.section) ||
		getOrder(groupOrderIndex, left.meta?.group) -
			getOrder(groupOrderIndex, right.meta?.group) ||
		getOrder(routeOrderIndex, left.name) - getOrder(routeOrderIndex, right.name)
	)
}

function getOrder<TItem>(orderIndex: ReadonlyMap<TItem, number>, item: TItem | undefined) {
	if (item === undefined) return Number.MAX_SAFE_INTEGER
	return orderIndex.get(item) ?? Number.MAX_SAFE_INTEGER
}

function joinRoutePath(basePath: string, routePath: string) {
	const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "")
	return `${normalizedBasePath}/${routePath}`
}

export function getNavigationMatch(
	navigation: readonly PrimaryNavigationItem[],
	pathname: string,
): NavigationMatch | undefined {
	for (const section of navigation) {
		for (const group of section.groups) {
			const item = group.items.find((candidate) => candidate.href === pathname)
			if (item || group.href === pathname) return { section, group, item }
		}
	}
	return undefined
}

function flattenRoutes(routes: readonly Route[]): Route[] {
	return routes.flatMap((route) => [
		route,
		...(route.children ? flattenRoutes(route.children) : []),
	])
}

function isMenuVisible(route: Route, access: AccessContext) {
	const menuVisible = route.meta?.menuVisible
	if (typeof menuVisible === "function") return menuVisible(access)
	return menuVisible !== false
}
