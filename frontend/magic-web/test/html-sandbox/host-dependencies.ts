/** Backend, logged-in application state and native UI boundaries for hook fixtures.
 * Never replace a hook/service/proxy here: their protocol and lifecycle are tested.
 */
export interface DependencyCall {
	method: string
	args: unknown[]
}
export const dependencyCalls: DependencyCall[] = []
export function record(method: string, ...args: unknown[]) {
	dependencyCalls.push({ method, args })
}

export async function getIframeDownloadUrl(fileIds: string[], access?: unknown) {
	record("file.downloadUrl", fileIds, access)
	return fileIds.map((fileId) => ({
		file_id: fileId,
		url: "data:text/plain,fixture%20file%20content",
	}))
}

export const useFileApi = () => ({
	getTemporaryDownloadUrl: ({ file_ids }: { file_ids: string[] }) =>
		getIframeDownloadUrl(file_ids),
})

export const getMagicBaseTables = async (projectId: string, access: unknown) => {
	record("database.getTables", projectId, access)
	return [{ id: "fixture-table", name: "Fixture table" }]
}
export const getMagicBaseProjectAdminAccess = async (projectId: string, access: unknown) => {
	record("database.getAdminAccess", projectId, access)
	return { project_id: projectId, is_admin: false }
}
export const getMagicBaseTable = async (...args: unknown[]) => {
	record("database.getTable", ...args)
	return { id: "fixture-table" }
}
export const createMagicBaseRow = async (...args: unknown[]) => {
	record("database.createRow", ...args)
	return { id: "fixture-row" }
}
export const queryMagicBaseRows = async (...args: unknown[]) => {
	record("database.queryRows", ...args)
	return { items: [{ id: "fixture-row" }] }
}
export const getMagicBaseRow = async (...args: unknown[]) => {
	record("database.getRow", ...args)
	return { id: "fixture-row" }
}
export const updateMagicBaseRow = async (...args: unknown[]) => {
	record("database.updateRow", ...args)
	return { id: "fixture-row" }
}
export const deleteMagicBaseRow = async (...args: unknown[]) => {
	record("database.deleteRow", ...args)
}
export const getMagicBaseRelations = async (...args: unknown[]) => {
	record("database.getRelations", ...args)
	return []
}

export const SuperMagicApi = {
	createTopic: async (...args: unknown[]) => {
		record("topic.create", ...args)
		return { id: "fixture-topic" }
	},
}
export const workspaceStore = { selectedWorkspace: { id: "fixture-workspace" } }
export const getCachedChatWorkspaceId = () => null
export const addMultipleFilesToCurrentChat = (...args: unknown[]) =>
	record("message.addFiles", ...args)
export const downloadFileWithAnchor = async (...args: unknown[]) => {
	record("file.download", ...args)
}
export const waitForProjectAttachmentChange = async (...args: unknown[]) => {
	record("attachments.wait", ...args)
	return { status: "applied", projectId: "fixture-project", matchMode: "exact-file" }
}
export const resolveAgentSelection = (modeIdentifier = "general") => ({ modeIdentifier })
export const isAgentSelectionAvailable = () => true
export const useTranslation = () => ({ t: (key: string) => key })
export const logger = {
	createLogger: () => ({ error: (...args: unknown[]) => record("logger.error", ...args) }),
}
export default {
	loading: (...args: unknown[]) => record("toast.loading", ...args),
	success: (...args: unknown[]) => record("toast.success", ...args),
	error: (...args: unknown[]) => record("toast.error", ...args),
	warning: (...args: unknown[]) => record("toast.warning", ...args),
	destroy: (...args: unknown[]) => record("toast.destroy", ...args),
}
