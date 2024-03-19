import { ContactApi, FlowApi } from "@/opensource/apis"
import type { IMCPItem } from "@/opensource/components/Agent/MCP"

export abstract class MCPSave {
	/** Get MCP configuration */
	abstract getMCP(): Promise<Array<IMCPItem>>
	/** Save MCP configuration */
	abstract saveMCP(value: Array<{ id: string }>): Promise<void>
}

/**
 * Reserved user-level storage strategy.
 * It is currently unused, but kept for future MCP scope support.
 */
export class UserGlobalStorage extends MCPSave {
	private readonly storageKey = "super_magic_mcp_servers"

	async getMCP(): Promise<Array<IMCPItem>> {
		try {
			const { value } = await ContactApi.getUserStorage<{ servers: Array<IMCPItem> }>(
				this.storageKey,
			)
			return value?.servers || []
		} catch (error) {
			console.error("User storage get MCP error", error)
			return []
		}
	}

	async saveMCP(value: Array<{ id: string }>): Promise<void> {
		await ContactApi.saveUserStorage({
			key: this.storageKey,
			value: {
				servers: value,
			},
		})
	}
}

/** Super Magic project storage strategy */
export class ProjectStorage extends MCPSave {
	private readonly storageKey: string = "__template_project_id__"

	constructor(storageKey?: string) {
		super()
		if (storageKey) {
			this.storageKey = storageKey
		}
	}

	async getMCP(): Promise<Array<IMCPItem>> {
		try {
			const { servers } = await FlowApi.getMCPFromProject(this.storageKey)
			return servers || []
		} catch (error) {
			console.error("Project storage get MCP error", error)
			return []
		}
	}

	async saveMCP(value: Array<IMCPItem>): Promise<void> {
		await FlowApi.saveMCPFromProject(this.storageKey, value)
	}
}

export class MCPStorageService {
	private storage: MCPSave

	constructor(storage: MCPSave) {
		this.storage = storage
	}

	async getMCP(): Promise<Array<IMCPItem>> {
		return this.storage.getMCP()
	}

	async hasMCP(): Promise<boolean> {
		const mcpList = await this.getMCP()
		return mcpList.length > 0
	}

	async saveMCP(value: Array<{ id: string }>): Promise<void> {
		await this.storage.saveMCP(value)
	}
}
