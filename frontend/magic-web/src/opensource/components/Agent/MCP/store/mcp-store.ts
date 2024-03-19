import { makeAutoObservable, runInAction } from "mobx"
import type { IMCPItem } from "../types"
import { MCPStorageService, ProjectStorage } from "../service/MCPStorageService"

interface SaveMCPPayload {
	selectedIds: Set<string>
	items?: Array<IMCPItem>
}

type MCPPersistMode = "ids" | "items"

export class MCPStore {
	mcpList: Array<IMCPItem> = []
	loading = false
	initialized = false

	private readonly storage: MCPStorageService
	private readonly persistMode: MCPPersistMode

	constructor(storage: MCPStorageService, persistMode: MCPPersistMode = "ids") {
		this.storage = storage
		this.persistMode = persistMode
		makeAutoObservable(this, {}, { autoBind: true })
	}

	get hasMCP() {
		return this.mcpList.length > 0
	}

	async load() {
		if (this.loading) return

		this.loading = true
		try {
			const mcpList = await this.storage.getMCP()
			runInAction(() => {
				this.mcpList = mcpList
				this.initialized = true
			})
		} catch (error) {
			runInAction(() => {
				this.initialized = true
			})
			throw error
		} finally {
			runInAction(() => {
				this.loading = false
			})
		}
	}

	async save({ selectedIds, items = [] }: SaveMCPPayload) {
		const payload =
			this.persistMode === "items"
				? items.filter((item) => selectedIds.has(item.id))
				: Array.from(selectedIds).map((id) => ({ id }))

		await this.storage.saveMCP(payload)
		await this.load()
	}

	async remove(id: string) {
		const selectedIds = new Set(
			this.mcpList.filter((item) => item.id !== id).map((item) => item.id),
		)
		await this.save({
			selectedIds,
			items: this.mcpList,
		})
	}
}

export const defaultMCPStore = new MCPStore(new MCPStorageService(new ProjectStorage()))
