import { makeAutoObservable } from "mobx"
import { keyBy } from "lodash-es"
import { platformKey } from "@/utils/storage"
import { userStore } from "@/models/user"
import { LRUCache, createLRUCache } from "../../../../utils/LRUCache"
import {
	MentionItemType,
	type MentionData,
	type MentionItem,
	type ProjectFileMentionData,
} from "../../../../types"
import { MentionPanelItemType } from "../../panel-item-types"
import type {
	MentionHistoryAsItemsOptions,
	MentionHistoryItem,
	MentionHistoryQueryOptions,
	MentionHistoryStoreDependencies,
} from "./types"

function getProjectFilePath(data?: MentionData): string | undefined {
	if (!data) return undefined
	if (!("file_path" in data)) return undefined
	return typeof data.file_path === "string" ? data.file_path : undefined
}

function getProjectFileId(data?: MentionData): string | undefined {
	if (!data) return undefined
	if (!("file_id" in data)) return undefined
	return typeof data.file_id === "string" ? data.file_id : undefined
}

export class MentionPanelHistoryStore {
	private readonly projectFilesStore: MentionHistoryStoreDependencies["projectFilesStore"]
	private readonly getCurrentTabs: MentionHistoryStoreDependencies["getCurrentTabs"]
	private historyCaches = new Map<string, LRUCache<MentionHistoryItem>>()

	constructor(dependencies: MentionHistoryStoreDependencies) {
		this.projectFilesStore = dependencies.projectFilesStore
		this.getCurrentTabs = dependencies.getCurrentTabs
		makeAutoObservable(this, {}, { autoBind: true })
		this.initializeHistoryCache()
	}

	private initializeHistoryCache() {
		this.getHistoryCache("global")
	}

	checkHistoryCache(cache: LRUCache<MentionHistoryItem>) {
		const items = cache.getAll()
		const invalidKeys: string[] = []
		items.forEach((item) => {
			const key = this.getHistoryItemKey({
				type: item.value.type,
				data: item.value.data,
				id: item.value.id,
				name: item.value.name,
			})
			if (key !== item.key) invalidKeys.push(item.key)
		})
		invalidKeys.forEach((key) => {
			cache.delete(key)
		})
	}

	private getHistoryCache(namespace: string): LRUCache<MentionHistoryItem> {
		const existingCache = this.historyCaches.get(namespace)
		if (existingCache) return existingCache

		const cache = createLRUCache<MentionHistoryItem>({
			maxSize: 10,
			namespace,
			enablePersistence: true,
			storagePrefix: platformKey("mention-panel-history/" + userStore.user.userInfo?.user_id),
		})
		this.historyCaches.set(namespace, cache)
		return cache
	}

	private getCurrentNamespace(): string {
		return this.projectFilesStore.currentSelectedProject?.id || "global"
	}

	getHistoryItemKey(item: {
		type: MentionItem["type"]
		data?: MentionData
		id: string
		name: string
	}) {
		switch (item.type) {
			case MentionItemType.PROJECT_FILE:
				return `${item.type}_${(item.data as ProjectFileMentionData).file_path}`
			default:
				return `${item.type}_${item.id || item.name}`
		}
	}

	addToHistory(item: MentionItem) {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		const key = this.getHistoryItemKey({
			type: item.type,
			data: item.data,
			id: item.id,
			name: item.name,
		})
		const existing = cache.get(key)
		const usage = existing ? existing.usage + 1 : 1

		const historyItem: MentionHistoryItem = {
			id: key,
			name: item.name,
			description: typeof item.description === "string" ? item.description : undefined,
			type: item.type,
			data: item.data,
			icon: typeof item.icon === "string" ? item.icon : undefined,
			usage,
		}

		cache.put(key, historyItem)
	}

	getHistoryCount() {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		return cache.getCount()
	}

	getHistory(options: MentionHistoryQueryOptions = {}): MentionHistoryItem[] {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		const { count, filter } = options

		this.checkHistoryCache(cache)

		const workspaceFileList = keyBy(
			this.projectFilesStore.workspaceFilesList.filter((file) => file.type === "file"),
			"relative_file_path",
		)

		const items = cache.getRecent(count, (item) => {
			if (item.value.type === MentionItemType.PROJECT_FILE) {
				const filePath = getProjectFilePath(item.value.data)
				if (!filePath) return false

				return !!workspaceFileList[filePath] || !!workspaceFileList["/" + filePath]
			}

			return filter ? filter(item.value) : true
		})

		return items
			.map((cacheItem) => cacheItem.value)
			.sort((a, b) => {
				if (a.usage !== b.usage) return b.usage - a.usage
				return 0
			})
	}

	getRecentHistory(count: number = 5) {
		return this.getHistory({ count })
	}

	removeFromHistory(itemId: string) {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		cache.delete(itemId)
	}

	clearHistory() {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		cache.clear()
	}

	searchHistory(query: string) {
		if (!query.trim()) return this.getHistory()

		const allHistory = this.getHistory()
		const lowercaseQuery = query.toLowerCase()

		return allHistory.filter((item) => {
			return (
				item.name.toLowerCase().includes(lowercaseQuery) ||
				item.description?.toLowerCase().includes(lowercaseQuery) ||
				item.type.toLowerCase().includes(lowercaseQuery)
			)
		})
	}

	historyToMentionItem(
		historyItem: MentionHistoryItem,
		customTag?: "tab" | "history",
	): MentionItem {
		const tags = ["recent"]
		if (customTag) tags.push(customTag)

		return {
			id: getProjectFileId(historyItem.data) || historyItem.id,
			name: historyItem.name,
			description: historyItem.description,
			type: historyItem.type,
			data: historyItem.data,
			icon: historyItem.icon || "",
			hasChildren: false,
			isFolder: false,
			metadata: {
				historyItemId: historyItem.id,
			},
			tags,
		}
	}

	getAllHistoryItems() {
		return this.getHistory().map((item) => this.historyToMentionItem(item, "history"))
	}

	getHistoryAsMentionItems(options: MentionHistoryAsItemsOptions) {
		const { count = 5, t } = options
		const allHistoryCount = this.getHistoryCount()
		const fileIds = this.getCurrentTabs().map((item) => item.fileData.file_id)

		const history = this.getHistory({
			count,
			filter: (item) => {
				if (item.type === MentionItemType.PROJECT_FILE) {
					const fileId = getProjectFileId(item.data)
					if (!fileId) return false
					return !fileIds.includes(fileId)
				}
				return true
			},
		})

		if (history.length <= count && allHistoryCount <= count) {
			return history.map((item) => this.historyToMentionItem(item, "history"))
		}

		return history
			.map((item) => this.historyToMentionItem(item, "history"))
			.concat([
				{
					id: "histories",
					type: MentionPanelItemType.HISTORIES,
					name: t.historyActions.viewAllMentionedFiles,
					hasChildren: true,
					isFolder: true,
				},
			])
	}

	getHistoryStats() {
		const namespace = this.getCurrentNamespace()
		const cache = this.getHistoryCache(namespace)
		return cache.getStats()
	}

	clearAllHistory() {
		this.historyCaches.forEach((cache) => cache.clear())
		this.historyCaches.clear()
		this.initializeHistoryCache()
	}
}
