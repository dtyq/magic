import { MCPSave } from "@/opensource/components/Agent/MCP/service/MCPStorageService"
import type { IMCPItem } from "@/opensource/components/Agent/MCP/types"

class MCPTempStorage extends MCPSave {
	mcpList: Array<IMCPItem> = []

	getMCP(): Promise<Array<IMCPItem>> {
		return Promise.resolve(this.mcpList)
	}

	saveMCP(mcpServers: Array<IMCPItem>) {
		this.mcpList = mcpServers
		return Promise.resolve()
	}
}

const mcpTempStorage = new MCPTempStorage()

export default mcpTempStorage
