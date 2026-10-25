import { MentionItemType, type MentionItem, type ProjectFileMentionData } from "../../../types"
import type { MentionPanelPluginHost } from "../registry-types"
import { mentionPanelSearchPlugins } from "../registry"
import { fuzzyMatch, includesSearchQuery, matchesQuery, normalizeSearchText } from "./matching"

export { fuzzyMatch, includesSearchQuery, matchesQuery, normalizeSearchText } from "./matching"

export async function searchBuiltinMentionItems(params: {
	query: string
	pluginHost: MentionPanelPluginHost
}): Promise<MentionItem[]> {
	const { query, pluginHost } = params
	if (!query || query.trim() === "") return []

	const pluginQuery = query.trim()
	const normalizedQuery = pluginQuery.toLowerCase()
	const results = (
		await Promise.all(
			mentionPanelSearchPlugins.map((plugin) =>
				plugin.search({
					store: pluginHost,
					query: pluginQuery,
					normalizedQuery,
				}),
			),
		)
	).flat()

	return sortSearchResults(dedupeSearchResults(results), normalizedQuery)
}

/**
 * Keeps the first result per type + id. A scene catalog lists files the project search also
 * finds, e.g. this study's report.html; the scene's copy (with its label) comes first and wins.
 */
function dedupeSearchResults(results: MentionItem[]): MentionItem[] {
	const seen = new Set<string>()
	return results.filter((item) => {
		const key = `${item.type}:${item.id}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

export function sortSearchResults(results: MentionItem[], normalizedQuery: string): MentionItem[] {
	const searchQuery = normalizeSearchText(normalizedQuery)

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

		const aMatchPriority = getSearchMatchPriority(a, searchQuery)
		const bMatchPriority = getSearchMatchPriority(b, searchQuery)
		if (aMatchPriority !== bMatchPriority) return aMatchPriority - bMatchPriority

		return aName.localeCompare(bName)
	})
}

function getSearchMatchPriority(item: MentionItem, normalizedQuery: string): number {
	const candidates: string[] = [item.name, item.package_name].filter(
		(value): value is string => typeof value === "string" && value.length > 0,
	)
	const normalizedCandidates = candidates.map(normalizeSearchText)

	if (normalizedCandidates.some((candidate) => candidate === normalizedQuery)) return 0
	if (normalizedCandidates.some((candidate) => candidate.startsWith(normalizedQuery))) return 1
	if (normalizedCandidates.some((candidate) => candidate.includes(normalizedQuery))) return 2
	if (normalizedCandidates.some((candidate) => fuzzyMatch(candidate, normalizedQuery))) return 3

	return item.description && includesSearchQuery(item.description, normalizedQuery) ? 4 : 5
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
