import type { createMentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type {
	MentionStoreRequest,
	MentionStoreResult,
} from "@/components/business/MentionPanel/dispatch"
import {
	MentionItemType,
	type DataService,
	type MentionItem,
} from "@/components/business/MentionPanel/types"

const ALLOWED_SELECTABLE_TYPES = new Set([
	MentionItemType.SKILL,
	MentionItemType.MCP,
	MentionItemType.TOOL,
	MentionItemType.AGENT,
])

const ALLOWED_DECORATION_TYPES = new Set([MentionItemType.TITLE, MentionItemType.DIVIDER])

function isAllowedMentionItem(item: MentionItem) {
	return ALLOWED_SELECTABLE_TYPES.has(item.type) || ALLOWED_DECORATION_TYPES.has(item.type)
}

function trimDecorations(items: MentionItem[]): MentionItem[] {
	const filtered = items.filter(isAllowedMentionItem)
	const normalized: MentionItem[] = []

	for (const item of filtered) {
		const previous = normalized[normalized.length - 1]
		const isDivider = item.type === MentionItemType.DIVIDER
		const isTitle = item.type === MentionItemType.TITLE

		if (normalized.length === 0 && (isDivider || isTitle)) continue
		if (isDivider && previous?.type === MentionItemType.DIVIDER) continue
		if (isTitle && previous?.type === MentionItemType.TITLE) continue

		normalized.push(item)
	}

	while (
		normalized.length > 0 &&
		ALLOWED_DECORATION_TYPES.has(normalized[normalized.length - 1].type)
	) {
		normalized.pop()
	}

	return normalized
}

export function createPromptMentionDataService(
	baseStore: ReturnType<typeof createMentionPanelStore>,
): DataService {
	return {
		dispatch(request: MentionStoreRequest): Promise<MentionStoreResult> | MentionStoreResult {
			const result = baseStore.dispatch(request)

			const mapResult = (resolved: MentionStoreResult): MentionStoreResult => {
				if (!resolved.items) return resolved
				return { ...resolved, items: trimDecorations(resolved.items) }
			}

			return result instanceof Promise ? result.then(mapResult) : mapResult(result)
		},
	}
}
