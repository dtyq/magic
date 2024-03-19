import { RouteName } from "@/opensource/routes/constants"
import { lazy } from "react"
import type { RouteSketchMap } from "./getRouteSketch"

export const routeSketchMap: RouteSketchMap = {
	[RouteName.Super]: {
		desktop: lazy(
			() =>
				import("@/opensource/pages/superMagic/lazy/skeleton/WorkspacePageDesktopSkeleton"),
		),
		mobile: lazy(
			() =>
				import("@/opensource/pages/superMagic/lazy/skeleton/WorkspacePageMobileSkeletonWithLayout"),
		),
	},
	[RouteName.MobileTabs]: {
		mobile: lazy(() => import("@/opensource/pages/mobileTabs/skeleton/MobileTabsSkeleton")),
	},
	[RouteName.SuperWorkspaceState]: {
		desktop: lazy(
			() =>
				import("@/opensource/pages/superMagic/lazy/skeleton/WorkspacePageDesktopSkeleton"),
		),
		mobile: lazy(
			() =>
				import("@/opensource/pages/superMagic/lazy/skeleton/WorkspacePageMobileSkeletonWithLayout"),
		),
	},
	[RouteName.SuperWorkspaceProjectState]: {
		desktop: lazy(
			() => import("@/opensource/pages/superMagic/lazy/skeleton/ProjectPageDesktopSkeleton"),
		),
		mobile: lazy(
			() =>
				import("@/opensource/pages/superMagic/lazy/skeleton/ProjectPageMobileSkeletonWithLayout"),
		),
	},
	[RouteName.SuperWorkspaceProjectTopicState]: {
		desktop: lazy(
			() => import("@/opensource/pages/superMagic/lazy/skeleton/TopicPageDesktopSkeleton"),
		),
		mobile: lazy(
			() => import("@/opensource/pages/superMagic/lazy/skeleton/TopicPageMobileSkeleton"),
		),
	},
	[RouteName.Chat]: {
		desktop: lazy(() => import("@/opensource/pages/chatNew/lazy/skeleton/ChatDesktopSkeleton")),
		mobile: lazy(() => import("@/opensource/pages/chatNew/lazy/skeleton/ChatMobileSkeleton")),
	},
	[RouteName.ChatConversation]: {
		mobile: lazy(
			() =>
				import("@/opensource/pages/chatMobile/lazy/skeleton/ChatConversationMobileSkeleton"),
		),
	},
	[RouteName.ChatSetting]: {
		mobile: lazy(
			() => import("@/opensource/pages/chatMobile/lazy/skeleton/ChatSettingMobileSkeleton"),
		),
	},
	[RouteName.SuperMagicNavigate]: {
		mobile: lazy(
			() =>
				import("@/opensource/pages/superMagic/lazy/skeleton/SuperMagicNavigateMobileSkeleton"),
		),
	},
	[RouteName.Contacts]: {
		mobile: lazy(
			() => import("@/opensource/pages/contacts/lazy/skeleton/ContactsMobileSkeleton"),
		),
	},
	[RouteName.ContactsOrganization]: {
		mobile: lazy(
			() =>
				import("@/opensource/pages/contacts/lazy/skeleton/ContactsOrganizationMobileSkeleton"),
		),
	},
	[RouteName.ContactsMyGroups]: {
		mobile: lazy(
			() =>
				import("@/opensource/pages/contacts/lazy/skeleton/ContactsMyGroupsMobileSkeleton"),
		),
	},
	[RouteName.ContactsAiAssistant]: {
		mobile: lazy(
			() =>
				import("@/opensource/pages/contacts/lazy/skeleton/ContactsAiAssistantMobileSkeleton"),
		),
	},
	[RouteName.Profile]: {
		mobile: lazy(
			() => import("@/opensource/pages/user/pages/my/lazy/skeleton/ProfileMobileSkeleton"),
		),
	},
	[RouteName.Explore]: {
		mobile: lazy(
			() => import("@/opensource/pages/explore/lazy/skeleton/ExploreMobileSkeleton"),
		),
	},
}
