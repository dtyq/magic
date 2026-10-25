import { makeAutoObservable } from "mobx"
import { SuperMagicApi } from "@/apis"
import type { MicroAppListItem } from "@/apis/modules/superMagic"
import { MentionItemType, type MentionItem, type MicroAppMentionData } from "../../../types"

const MENTION_PAGE_SIZE = 100

function listFromResponse(response: unknown): MicroAppListItem[] {
	if (!response || typeof response !== "object") return []
	const list = (response as { list?: unknown }).list
	return Array.isArray(list) ? (list as MicroAppListItem[]) : []
}

export function createMicroAppMentionItem(params: {
	appId: string
	appName?: string
	icon?: string | null
}): MentionItem | null {
	const appId = String(params.appId ?? "").trim()
	if (!appId) return null
	const appName = params.appName?.trim() || appId
	return {
		id: appId,
		type: MentionItemType.MICRO_APP,
		name: appName,
		icon: params.icon ?? "",
		hasChildren: false,
		isFolder: false,
		data: { app_id: appId, app_name: appName } as MicroAppMentionData,
	}
}

function toMentionItem(item: MicroAppListItem): MentionItem | null {
	if (item.publish_status !== "published" && item.publish_status !== "unpublished") return null
	return createMicroAppMentionItem({
		appId: String(item.app_id ?? ""),
		appName: item.app_name,
		icon: item.cover_url,
	})
}

function mapMentionItems(response: unknown): MentionItem[] {
	const seen = new Set<string>()
	return listFromResponse(response)
		.map(toMentionItem)
		.filter((item): item is MentionItem => {
			if (!item || seen.has(item.id)) return false
			seen.add(item.id)
			return true
		})
}

/** Fetch the full catalog before publishing it, including server-side search pages. */
async function loadMentionItems(keyword?: string): Promise<MentionItem[]> {
	const items = new Map<string, MentionItem>()
	for (let page = 1; ; page += 1) {
		const response = await SuperMagicApi.getMentionMicroApps({
			page,
			page_size: MENTION_PAGE_SIZE,
			...(keyword === undefined ? {} : { keyword }),
		})
		const list = listFromResponse(response)
		for (const item of mapMentionItems(response)) items.set(item.id, item)
		// Use raw pagination rather than visible/deduplicated counts to avoid truncation.
		const pageSize = response?.page_size > 0 ? response.page_size : MENTION_PAGE_SIZE
		if (
			!list.length ||
			(Number.isFinite(response?.total)
				? page * pageSize >= response.total
				: list.length < pageSize)
		)
			break
	}
	return [...items.values()]
}

export class MentionPanelMicroAppsStore {
	items: MentionItem[] = []
	private loaded = false
	private loading?: Promise<void>

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	async fetchItems({ force = false }: { force?: boolean } = {}) {
		if (!force && this.loaded) return
		if (this.loading) return this.loading
		if (typeof SuperMagicApi?.getMentionMicroApps !== "function") return
		this.loading = (async () => {
			try {
				this.items = await loadMentionItems()
				this.loaded = true
			} catch {
				if (!this.loaded) this.items = []
			}
		})()
		try {
			await this.loading
		} finally {
			this.loading = undefined
		}
	}

	async getItems() {
		// Reopen must refetch so newly published apps appear.
		await this.fetchItems({ force: true })
		return this.items
	}

	async searchItems(query: string, matchesQuery: (target: string, query: string) => boolean) {
		if (typeof SuperMagicApi?.getMentionMicroApps !== "function") {
			return this.items.filter((item) => matchesQuery(item.name, query))
		}
		try {
			const items = await loadMentionItems(query)
			return items.filter((item) => matchesQuery(item.name, query))
		} catch {
			await this.fetchItems().catch(() => undefined)
			return this.items.filter((item) => matchesQuery(item.name, query))
		}
	}
}
