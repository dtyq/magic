import type { TFunction } from "i18next"
import type { RecycleBin } from "@/apis/modules/recycle-bin"
import {
	buildRecycleBinPathLabel,
	getCategoryByResourceType,
	getRecycleBinItemTitle,
	RESOURCE_TYPE,
	type RecycleBinItem,
	type ResourceType,
} from "@/pages/recycleBin/components/recycle-bin-domain"
import { RECYCLE_BIN_RESOURCE_TYPE_TO_TAB_ID } from "@/pages/recycleBin/tab-config"
import type { RecycleBinItemData } from "../components/RecycleBinItem"

export { RESOURCE_TYPE }
export type { ResourceType }

function getMobileItemType(
	resourceType: ResourceType,
	isDirectory?: boolean,
): RecycleBinItemData["type"] {
	if (resourceType === RESOURCE_TYPE.FILE) return isDirectory ? "folder" : "file"
	if (resourceType === RESOURCE_TYPE.WORKSPACE) return "workspace"
	if (resourceType === RESOURCE_TYPE.PROJECT) return "project"
	if (resourceType === RESOURCE_TYPE.TOPIC) return "topic"
	if (resourceType === RESOURCE_TYPE.MICRO_APP) return "microApp"
	return "file"
}

export function mapListItemToItemData(item: RecycleBin.ListItem, t: TFunction): RecycleBinItemData {
	const resourceType = item.resource_type as ResourceType
	const type = getMobileItemType(resourceType, item.extra_data?.is_directory)
	const parentInfo = {
		space_type: item.extra_data?.space_type,
		...item.extra_data?.parent_info,
		workspace_name:
			item.extra_data?.parent_info?.workspace_name ?? item.extra_data?.workspace_name,
		project_name: item.extra_data?.parent_info?.project_name ?? item.extra_data?.project_name,
		relative_file_path: item.extra_data?.relative_file_path,
	}
	const path = buildRecycleBinPathLabel({
		resourceType,
		parentInfo,
		resourceName: item.resource_name,
		t,
	})
	return {
		id: item.id,
		type,
		title: getRecycleBinItemTitle({
			resourceName: item.resource_name,
			resourceType,
			t,
		}),
		deletedAt: item.deleted_at,
		validDays: item.remaining_days ?? 0,
		resourceId: item.resource_id,
		resourceType,
		selected: false,
		path,
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
		microApps: 0,
	}
	items.forEach((item) => {
		const tab = RECYCLE_BIN_RESOURCE_TYPE_TO_TAB_ID[item.resourceType]
		if (tab) counts[tab] = (counts[tab] ?? 0) + 1
	})
	onTabCountChange("all", counts.all)
	onTabCountChange("workspaces", counts.workspaces)
	onTabCountChange("projects", counts.projects)
	onTabCountChange("topics", counts.topics)
	onTabCountChange("files", counts.files)
	onTabCountChange("microApps", counts.microApps)
}

export function mobileItemDataToDomain(item: RecycleBinItemData): RecycleBinItem {
	return {
		id: item.id,
		resourceId: item.resourceId,
		resourceType: item.resourceType as ResourceType,
		category: getCategoryByResourceType(item.resourceType as ResourceType),
		title: item.title,
		path: item.path,
		deletedOn: "",
		remainingDays: item.validDays,
	}
}
