import type { TFunction } from "i18next"
import type { RecycleBin } from "@/apis/modules/recycle-bin"
import {
	RESOURCE_TYPE,
	type RecycleBinItem,
	type ResourceType,
} from "@/pages/recycleBin/components/recycle-bin-domain"
import type { RecycleBinItemData } from "../components/RecycleBinItem"

export { RESOURCE_TYPE }
export type { ResourceType }

const RESOURCE_TYPE_TO_TAB: Record<ResourceType, string> = {
	[RESOURCE_TYPE.WORKSPACE]: "workspaces",
	[RESOURCE_TYPE.PROJECT]: "projects",
	[RESOURCE_TYPE.TOPIC]: "topics",
	[RESOURCE_TYPE.FILE]: "files",
}

const TAB_KEY_TO_TYPE: Record<string, RecycleBinItemData["type"]> = {
	workspaces: "workspace",
	projects: "project",
	topics: "topic",
	files: "file",
}

function getRecycleBinItemTitle(props: {
	resourceName?: string
	resourceType?: ResourceType
	t: TFunction
}) {
	const { resourceName, resourceType, t } = props
	const trimmedName = resourceName?.trim() ?? ""
	if (trimmedName) return trimmedName
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return t("common.unNamedWorkspace")
	if (resourceType === RESOURCE_TYPE.PROJECT) return t("common.untitledProject")
	if (resourceType === RESOURCE_TYPE.TOPIC) return t("common.untitledTopic")
	if (resourceType === RESOURCE_TYPE.FILE) return t("common.untitledFile")
	return trimmedName
}

export function mapListItemToItemData(item: RecycleBin.ListItem, t: TFunction): RecycleBinItemData {
	const resourceType = item.resource_type as ResourceType
	const tabKey = RESOURCE_TYPE_TO_TAB[resourceType] ?? "files"
	const type = TAB_KEY_TO_TYPE[tabKey] ?? "file"
	const deletedBy =
		item.deleted_by_user?.nickname ?? item.deleted_by_name ?? item.deleted_by ?? ""
	const deletedByUser = item.deleted_by_user
		? { nickname: item.deleted_by_user.nickname, avatar: item.deleted_by_user.avatar }
		: undefined
	const parentInfo = item.extra_data?.parent_info
	const workspaceName = parentInfo?.workspace_name?.trim() || ""
	const projectName = parentInfo?.project_name?.trim() || ""
	const pathJoined = [workspaceName, projectName].filter(Boolean).join(" / ")
	return {
		id: item.id,
		type,
		title: getRecycleBinItemTitle({
			resourceName: item.resource_name,
			resourceType,
			t,
		}),
		deletedBy,
		deletedByUser,
		deletedAt: item.deleted_at,
		validDays: item.remaining_days ?? 0,
		resourceId: item.resource_id,
		resourceType,
		selected: false,
		path: pathJoined || undefined,
	}
}

export function updateTabCounts(
	items: RecycleBinItemData[],
	onTabCountChange?: (tabId: string, count: number) => void,
) {
	if (!onTabCountChange) return
	const counts: Record<string, number> = {
		all: items.length,
		workspaces: 0,
		projects: 0,
		topics: 0,
		files: 0,
	}
	items.forEach((item) => {
		const tab = RESOURCE_TYPE_TO_TAB[item.resourceType as ResourceType]
		if (tab) counts[tab] = (counts[tab] ?? 0) + 1
	})
	onTabCountChange("all", counts.all)
	onTabCountChange("workspaces", counts.workspaces)
	onTabCountChange("projects", counts.projects)
	onTabCountChange("topics", counts.topics)
	onTabCountChange("files", counts.files)
}

const TYPE_TO_CATEGORY: Record<RecycleBinItemData["type"], RecycleBinItem["category"]> = {
	workspace: "workspaces",
	project: "projects",
	topic: "topics",
	file: "files",
}

export function mobileItemDataToDomain(item: RecycleBinItemData): RecycleBinItem {
	const path = item.path?.trim() ? item.path : "/"
	return {
		id: item.id,
		resourceId: item.resourceId,
		resourceType: item.resourceType as ResourceType,
		category: TYPE_TO_CATEGORY[item.type],
		title: item.title,
		deletedBy: item.deletedBy,
		deletedByUser: item.deletedByUser,
		path,
		deletedOn: "",
		remainingDays: item.validDays,
	}
}
