import { DataService, MentionItem, MentionItemType } from "../types"
import type { MentionData } from "../types"
import type { MentionStoreResult, MentionStoreRequest } from "../dispatch"

export async function getMentionItemsByRequest(
	dataService: DataService | undefined,
	request: MentionStoreRequest,
): Promise<MentionItem[]> {
	if (!dataService) return []

	const result = await dataService.dispatch(request)
	return result.items ?? []
}

export function validateMentionWithDataService(
	dataService: DataService | null | undefined,
	item: {
		type: MentionItemType
		data?: MentionData
	},
): boolean {
	if (!dataService || !item.data) return false

	const result = dataService.dispatch({
		kind: "validate",
		item,
	})
	if (result instanceof Promise) return false

	return Boolean((result as MentionStoreResult).isValid)
}
