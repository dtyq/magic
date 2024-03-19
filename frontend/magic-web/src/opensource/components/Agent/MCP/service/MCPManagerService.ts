import type { IMCPItem } from "../types"
import { FlowApi } from "@/opensource/apis"

abstract class BaseMCP {
	/** Get MCP list */
	abstract getMCPList(name?: string): Promise<Array<IMCPItem>>

	/** Obtain MCP usage kit */
	abstract getMCPStatus(): Promise<any>

	/** Change MCP usage kit */
	abstract setMCPStatus(item: IMCPItem): Promise<IMCPItem>
}

// Official MCP
export class OfficialStrategy extends BaseMCP {
	async getMCPList(name?: string): Promise<Array<IMCPItem>> {
		const data = await FlowApi.getUseableMCPList({
			name,
			office: true,
		})
		return data?.list || []
	}

	getMCPStatus(): Promise<any> {
		return new Promise((resolve) => resolve([]))
	}

	setMCPStatus(item: IMCPItem): Promise<IMCPItem> {
		return new Promise((resolve) => resolve(item))
	}
}

// Organization MCP
export class OrganizationStrategy extends BaseMCP {
	async getMCPList(name?: string): Promise<Array<IMCPItem>> {
		const data = await FlowApi.getUseableMCPList({ name })
		return data?.list || []
	}

	getMCPStatus(): Promise<any> {
		return new Promise((resolve) => resolve([]))
	}

	setMCPStatus(item: IMCPItem): Promise<IMCPItem> {
		return new Promise((resolve) => resolve(item))
	}
}

// Person MCP
export class PersonStrategy extends BaseMCP {
	getMCPList(name?: string): Promise<Array<IMCPItem>> {
		return new Promise((resolve) => {
			console.log(name)
			setTimeout(() => {
				resolve([])
			}, 500)
		})
	}

	getMCPStatus(): Promise<any> {
		return new Promise((resolve) => resolve([]))
	}

	setMCPStatus(item: IMCPItem): Promise<IMCPItem> {
		return new Promise((resolve) => resolve(item))
	}
}

export class MCPManagerService {
	private context: BaseMCP | null = null

	constructor(context?: BaseMCP) {
		if (context) {
			this.context = context
		}
	}

	setContext(context: BaseMCP) {
		this.context = context
	}

	getMCPList(name?: string) {
		if (!this.context) {
			throw new Error("MCP context not set")
		}
		return this.context.getMCPList(name)
	}

	getMCPStatus() {
		if (!this.context) {
			throw new Error("MCP context not set")
		}
		return this.context.getMCPStatus()
	}

	setMCPStatus(item: IMCPItem) {
		if (!this.context) {
			throw new Error("MCP context not set")
		}
		return this.context.setMCPStatus(item)
	}
}
