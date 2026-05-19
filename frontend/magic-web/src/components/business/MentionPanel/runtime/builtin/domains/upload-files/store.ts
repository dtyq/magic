import { makeAutoObservable } from "mobx"
import type { MentionItem } from "../../../../types"

export class MentionPanelUploadFilesStore {
	items: MentionItem[] = []

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	setItems(files: MentionItem[]) {
		this.items = files
	}

	getItems() {
		return this.items
	}

	searchItems(normalizedQuery: string, matchesQuery: (target: string, query: string) => boolean) {
		return this.items.filter((item) => matchesQuery(item.name, normalizedQuery))
	}

	hasItem(fileId: string) {
		return this.items.some((item) => item.id === fileId)
	}
}
