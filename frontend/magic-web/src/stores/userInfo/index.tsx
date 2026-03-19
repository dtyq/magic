import type { StructureUserItem } from "@/types/organization"
import { makeAutoObservable } from "mobx"

class UserInfoStore {
	map: Map<IDBValidKey, StructureUserItem> = new Map()

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get(key: string): StructureUserItem | undefined {
		return this.map.get(key)
	}

	set(key: string, value: StructureUserItem) {
		this.map.set(key, value)
	}
}

export default new UserInfoStore()
