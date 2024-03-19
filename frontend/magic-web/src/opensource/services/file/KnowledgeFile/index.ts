import KnowledgeFileService from "./KnowledgeFileService"

/**
 * 初始化文件服务
 */
export async function initKnowledgeFileService() {
	try {
		// 初始化知识库文件服务
		await KnowledgeFileService.init()

		console.log("文件服务初始化完成")
	} catch (error) {
		console.error("文件服务初始化失败", error)
	}
}

// 导出服务
export { default as KnowledgeFileService } from "./KnowledgeFileService"
export { default as KnowledgeFileDbService } from "./KnowledgeFileDbService"

// 导出类型
export type { KnowledgeFileUrlData, KnowledgeFileCacheData } from "./KnowledgeFileService"
