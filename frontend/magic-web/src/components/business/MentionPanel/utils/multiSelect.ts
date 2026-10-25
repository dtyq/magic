import type { AgentMentionData, MentionItem, NavigationItem } from "../types"
import { MentionItemType, PanelState } from "../types"
import { MentionPanelBuiltinItemId as BuiltinRootId } from "../runtime/builtin/catalog-ids"
import { isSelectableBuiltinItemId } from "../runtime/builtin/default-items"

export interface PendingMentionEntry {
	item: MentionItem
	/** 归属的一级入口行 id（如 project-files），用于根列表角标 */
	sourceRootId: string | null
	mcpValidated?: boolean
}

export function getMentionItemSelectionKey(item: MentionItem): string {
	return `${item.type}:${item.id}`
}

/** A folder represents a navigation target, even when a host omits `isFolder`. */
export function isMentionFolderItem(item: MentionItem): boolean {
	return item.isFolder === true || item.type === MentionItemType.FOLDER
}

export function canTogglePendingItem(item: MentionItem): boolean {
	if (item.type === MentionItemType.TITLE || item.type === MentionItemType.DIVIDER) return false
	if (item.unSelectable) return false
	return isSelectableBuiltinItemId(item.id)
}

export function canTogglePendingLeafItem(item: MentionItem): boolean {
	if (!canTogglePendingItem(item)) return false
	if (item.hasChildren || item.children?.length) return false
	return true
}

/** 一级类目入口页：仅下钻，不展示多选、不写入暂存 */
export function isRootDefaultCategoryScreen(state: {
	currentState: PanelState
	navigationStack: { length: number }
	searchQuery: string
}): boolean {
	return (
		state.currentState === PanelState.DEFAULT &&
		state.navigationStack.length === 0 &&
		!state.searchQuery.trim()
	)
}

/** 无导航栈时按条目类型归因到一级入口 */
export function inferRootEntryIdFromItem(item: MentionItem): string | null {
	switch (item.type) {
		case MentionItemType.PROJECT_FILE:
			return BuiltinRootId.PROJECT_FILES
		case MentionItemType.MCP:
			return BuiltinRootId.MCP_EXTENSIONS
		case MentionItemType.AGENT:
			return (item.data as AgentMentionData | undefined)?.agent_source === "digital_employee"
				? BuiltinRootId.DIGITAL_EMPLOYEES
				: BuiltinRootId.AGENTS
		case MentionItemType.MICRO_APP:
			return BuiltinRootId.MICRO_APPS
		case MentionItemType.SKILL:
			return BuiltinRootId.SKILLS
		case MentionItemType.TOOL:
			return BuiltinRootId.TOOLS
		case MentionItemType.UPLOAD_FILE:
			return BuiltinRootId.UPLOAD_FILES
		case MentionItemType.CLOUD_FILE: {
			const p = (item.data as { cloud_provider?: string } | undefined)?.cloud_provider
			if (p === "enterprise") return BuiltinRootId.ENTERPRISE_DRIVE
			if (p === "personal") return BuiltinRootId.PERSONAL_DRIVE
			return BuiltinRootId.PERSONAL_DRIVE
		}
		case MentionItemType.FOLDER:
			return BuiltinRootId.PROJECT_FILES
		default:
			return null
	}
}

export function getPendingSourceRootId(
	navigationStack: NavigationItem[],
	item: MentionItem,
): string | null {
	if (navigationStack.length > 0) {
		const first = navigationStack[0]
		if (first.id === "search-results") {
			if (navigationStack.length > 1) {
				const second = navigationStack[1]
				return second.catalogId ?? second.id
			}
			return inferRootEntryIdFromItem(item)
		}
		return first.catalogId ?? first.id
	}
	return inferRootEntryIdFromItem(item)
}

export function getSubmittablePendingEntries(
	pendingByKey: Map<string, PendingMentionEntry>,
): PendingMentionEntry[] {
	return Array.from(pendingByKey.values()).filter((entry) =>
		isSelectableBuiltinItemId(entry.item.id),
	)
}
