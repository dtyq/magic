import { useMemo } from "react"

export interface MenuItem {
	icon: string
	labelKey: string
	color?: string
	maskColor?: string
	badge?: "dot" | number | false
	key: MenuKey
}

export const enum MenuKey {
	SuperMagic = "superMagic",
	Flow = "flowOrchestration",
	LongTermMemory = "longTermMemory",
	ArchiveSpace = "archiveSpace",
	ShareManagement = "shareManagement",
	TimedTasks = "timedTasks",
	Preferences = "preferences",
	Chat = "chat",
	Contacts = "contacts",
	Applications = "applications",
	CloudDrive = "cloudDrive",
	KnowledgeBase = "knowledgeBase",
	Approval = "approval",
	Schedule = "schedule",
	Tasks = "tasks",
	Favorites = "favorites",
}

const iconMap = {
	[MenuKey.Flow]: "Workflow",
	[MenuKey.Chat]: "MessageSquareText",
	[MenuKey.Contacts]: "Contact",
}

function useMenuItems() {
	return useMemo<MenuItem[]>(
		() => [
			{
				icon: iconMap[MenuKey.Chat],
				labelKey: "globalMenus.instantMessaging",
				key: MenuKey.Chat,
			},
			{
				icon: iconMap[MenuKey.Contacts],
				labelKey: "globalMenus.contacts",
				key: MenuKey.Contacts,
			},
			{
				icon: iconMap[MenuKey.Flow],
				labelKey: "globalMenus.flowOrchestration",
				key: MenuKey.Flow,
			},
		],
		[],
	)
}

export default useMenuItems
