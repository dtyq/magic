import { MCPStorageService, ProjectStorage } from "../service/MCPStorageService"
import mcpTempStorage from "@/components/business/AccountSetting/pages/ScheduledTasks/store/MCPTempStorage"
import { MCPStore, defaultMCPStore } from "./mcp-store"

interface GetMCPAccessParams {
	storageKey?: string
	useTempStorage?: boolean
}

const projectMCPStoreMap = new Map<string, MCPStore>()
const tempMCPStore = new MCPStore(new MCPStorageService(mcpTempStorage), "items")
const connectorReconciliationPromises = new Map<string, Promise<void>>()

interface LoadMCPWithInstalledConnectorReconciliationParams {
	installedAccess: MCPStore
	activeAccess: MCPStore
	activeStorageKey: string
}

/**
 * Keep project-enabled connectors within the globally installed connector set.
 * Installed-only entries stay disabled, while project-only entries are removed
 * instead of being migrated back into the installed bucket.
 */
async function runInstalledConnectorReconciliation({
	installedAccess,
	activeAccess,
}: LoadMCPWithInstalledConnectorReconciliationParams) {
	if (installedAccess === activeAccess) {
		await installedAccess.load()
		return
	}

	const [installedResult, activeResult] = await Promise.allSettled([
		installedAccess.load(),
		activeAccess.load(),
	])
	// A failed request must never be interpreted as an intentionally empty bucket.
	if (installedResult.status === "rejected") throw installedResult.reason
	if (activeResult.status === "rejected") throw activeResult.reason

	const installedIds = new Set(installedAccess.mcpList.map((item) => item.id))
	const retainedActiveItems = activeAccess.mcpList.filter((item) => installedIds.has(item.id))
	if (retainedActiveItems.length === activeAccess.mcpList.length) return

	await activeAccess.save({
		selectedIds: new Set(retainedActiveItems.map((item) => item.id)),
		items: retainedActiveItems,
	})
}

/**
 * Load both connector buckets and reconcile one project at a time. Multiple
 * input surfaces can mount together, so sharing the in-flight promise prevents
 * duplicate cleanup PUTs.
 */
export function loadMCPWithInstalledConnectorReconciliation(
	params: LoadMCPWithInstalledConnectorReconciliationParams,
): Promise<void> {
	const existingPromise = connectorReconciliationPromises.get(params.activeStorageKey)
	if (existingPromise) return existingPromise

	const reconciliationPromise = runInstalledConnectorReconciliation(params).finally(() => {
		if (
			connectorReconciliationPromises.get(params.activeStorageKey) === reconciliationPromise
		) {
			connectorReconciliationPromises.delete(params.activeStorageKey)
		}
	})
	connectorReconciliationPromises.set(params.activeStorageKey, reconciliationPromise)
	return reconciliationPromise
}

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
