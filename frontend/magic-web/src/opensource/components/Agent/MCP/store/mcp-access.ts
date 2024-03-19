import { MCPStorageService, ProjectStorage } from "../service/MCPStorageService"
import mcpTempStorage from "@/opensource/components/business/AccountSetting/pages/ScheduledTasks/store/MCPTempStorage"
import { MCPStore, defaultMCPStore } from "./mcp-store"

interface GetMCPAccessParams {
	storageKey?: string
	useTempStorage?: boolean
}

const projectMCPStoreMap = new Map<string, MCPStore>()
const tempMCPStore = new MCPStore(new MCPStorageService(mcpTempStorage), "items")

export function getMCPAccess(params: GetMCPAccessParams = {}) {
	const { storageKey, useTempStorage = false } = params

	if (useTempStorage) return tempMCPStore
	if (!storageKey) return defaultMCPStore

	const cachedStore = projectMCPStoreMap.get(storageKey)
	if (cachedStore) return cachedStore

	const projectStore = new MCPStore(new MCPStorageService(new ProjectStorage(storageKey)))
	projectMCPStoreMap.set(storageKey, projectStore)
	return projectStore
}
