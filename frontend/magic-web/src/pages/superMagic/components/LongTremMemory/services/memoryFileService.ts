import { MagicFSApi, type MagicFSFile } from "@/apis"
import {
	userSpaceFileService,
	type UserFileSnapshot,
} from "../../UserSpace/services/userSpaceFileService"

export const MEMORY_SCOPE = "memory" as const
export const GLOBAL_MEMORY_DIRECTORY_NAME = "global"
export const MEMORY_ENTRY_FILE_NAME = "MEMORY.md"
/**
 * 文件记忆访问服务。
 *
 * 该服务负责屏蔽固定目录查找与通用文件接口差异，页面只处理展示状态。
 */
export class MemoryFileService {
	/** 查询记忆根目录或指定目录的直接子节点。 */
	async listDirectory(parentId?: string): Promise<MagicFSFile[]> {
		const response = await MagicFSApi.listFiles({
			scope: MEMORY_SCOPE,
			...(parentId ? { parent_id: parentId } : {}),
		})

		return response.files || []
	}

	/** 按固定目录结构定位全局记忆入口文件。 */
	async findGlobalMemoryFile(): Promise<MagicFSFile | null> {
		const roots = await this.listDirectory()
		const memoryRoot = roots.find((file) => file.is_directory && file.name === "memory")
		if (!memoryRoot) return null

		const memoryChildren = await this.listDirectory(memoryRoot.id)
		const globalDirectory = memoryChildren.find(
			(file) => file.is_directory && file.name === GLOBAL_MEMORY_DIRECTORY_NAME,
		)
		if (!globalDirectory) return null

		const globalChildren = await this.listDirectory(globalDirectory.id)
		return (
			globalChildren.find(
				(file) => !file.is_directory && file.name === MEMORY_ENTRY_FILE_NAME,
			) || null
		)
	}

	/** 确保固定的全局记忆文件存在，并返回可用于编辑的稳定快照。 */
	async ensureGlobalMemoryFile(): Promise<UserFileSnapshot> {
		const roots = await this.listDirectory()
		const memoryRoot = roots.find((file) => file.is_directory && file.name === "memory")
		if (!memoryRoot) {
			throw new Error("Memory root directory is missing")
		}

		let memoryChildren = await this.listDirectory(memoryRoot.id)
		let globalDirectory = memoryChildren.find(
			(file) => file.is_directory && file.name === GLOBAL_MEMORY_DIRECTORY_NAME,
		)

		if (!globalDirectory) {
			try {
				globalDirectory = await userSpaceFileService.createNode({
					name: GLOBAL_MEMORY_DIRECTORY_NAME,
					parentId: memoryRoot.id,
					isDirectory: true,
				})
			} catch (error) {
				memoryChildren = await this.listDirectory(memoryRoot.id)
				globalDirectory = memoryChildren.find(
					(file) => file.is_directory && file.name === GLOBAL_MEMORY_DIRECTORY_NAME,
				)
				if (!globalDirectory) throw error
			}
		}

		let globalChildren = await this.listDirectory(globalDirectory.id)
		let memoryFile = globalChildren.find(
			(file) => !file.is_directory && file.name === MEMORY_ENTRY_FILE_NAME,
		)

		if (!memoryFile) {
			try {
				memoryFile = await userSpaceFileService.createNode({
					name: MEMORY_ENTRY_FILE_NAME,
					parentId: globalDirectory.id,
					isDirectory: false,
				})
			} catch (error) {
				globalChildren = await this.listDirectory(globalDirectory.id)
				memoryFile = globalChildren.find(
					(file) => !file.is_directory && file.name === MEMORY_ENTRY_FILE_NAME,
				)
				if (!memoryFile) throw error
			}
		}

		return userSpaceFileService.readStableSnapshot(memoryFile.id)
	}
}

export const memoryFileService = new MemoryFileService()
