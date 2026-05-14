import { MentionItemType, type MentionItem, type ProjectFileMentionData } from "../../../types"
import type { MentionPanelPluginHost } from "../registry-types"
import { mentionPanelSearchPlugins } from "../registry"

export function fuzzyMatch(target: string, query: string): boolean {
	const targetLower = target.toLowerCase()
	const queryLower = query.toLowerCase()

	let queryIndex = 0

	for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
		if (targetLower[i] === queryLower[queryIndex]) queryIndex++
	}

	return queryIndex === queryLower.length
}

export function matchesQuery(target: string, query: string): boolean {
	const targetLower = target.toLowerCase()
	const queryLower = query.toLowerCase()

	if (targetLower.includes(queryLower)) return true

	return fuzzyMatch(target, query)
}

export async function searchBuiltinMentionItems(params: {
	query: string
	pluginHost: MentionPanelPluginHost
}): Promise<MentionItem[]> {
	const { query, pluginHost } = params
	if (!query || query.trim() === "") return []

	const normalizedQuery = query.toLowerCase().trim()
	const results = (
		await Promise.all(
			mentionPanelSearchPlugins.map((plugin) =>
				plugin.search({
					store: pluginHost,
					query,
					normalizedQuery,
				}),
			),
		)
	).flat()

	return sortSearchResults(results, normalizedQuery)
}

export function sortSearchResults(results: MentionItem[], normalizedQuery: string): MentionItem[] {
	return results.sort((a, b) => {
		const aName = a.name.toLowerCase()
		const bName = b.name.toLowerCase()

		const aPriority = getTypePriority(a.type)
		const bPriority = getTypePriority(b.type)

		if (aPriority !== bPriority) return aPriority - bPriority

		const aExtension = getItemExtension(a)
		const bExtension = getItemExtension(b)

		const aIsHtml = aExtension === "html" || aExtension === "htm"
		const bIsHtml = bExtension === "html" || bExtension === "htm"
		if (aIsHtml && !bIsHtml) return -1
		if (!aIsHtml && bIsHtml) return 1

		const aExact = aName === normalizedQuery
		const bExact = bName === normalizedQuery
		if (aExact && !bExact) return -1
		if (!aExact && bExact) return 1

		const aStarts = aName.startsWith(normalizedQuery)
		const bStarts = bName.startsWith(normalizedQuery)
		if (aStarts && !bStarts) return -1
		if (!aStarts && bStarts) return 1

		const aIncludes = aName.includes(normalizedQuery)
		const bIncludes = bName.includes(normalizedQuery)
		if (aIncludes && !bIncludes) return -1
		if (!aIncludes && bIncludes) return 1

		return aName.localeCompare(bName)
	})
}

function getTypePriority(type: string): number {
	switch (type) {
		case MentionItemType.PROJECT_FILE:
		case MentionItemType.UPLOAD_FILE:
		case MentionItemType.CLOUD_FILE:
		case MentionItemType.FOLDER:
			return 1
		case MentionItemType.MCP:
			return 2
		case MentionItemType.AGENT:
			return 3
		case MentionItemType.SKILL:
			return 4
		case MentionItemType.TOOL:
			return 5
		default:
			return 6
	}
}

function getItemExtension(item: MentionItem): string {
	return (
		item.extension?.toLowerCase() ||
		(item.data as ProjectFileMentionData)?.file_extension?.toLowerCase() ||
		""
	)
}
