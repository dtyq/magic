import { waitForNextAttachmentsRefreshForProject } from "@/pages/superMagic/services/attachmentsTopicSync"

export interface SyncFileInfoAfterGenerationCompleteParams {
	projectId: string
	filePath: string
	fileUrl: string
	fileName: string
	setFileInfoCache?: (path: string, fileInfo: { src: string; fileName: string }) => void
}

/**
 * 生图/生视频任务成功后：先等待附件列表刷新，再写入文件信息缓存。
 * 仅由 Design 侧 useImageGeneration / useVideoGeneration 的 getResult 调用。
 */
export async function syncFileInfoAfterGenerationComplete(
	params: SyncFileInfoAfterGenerationCompleteParams,
): Promise<void> {
	const { projectId, filePath, fileUrl, fileName, setFileInfoCache } = params
	try {
		await waitForNextAttachmentsRefreshForProject(projectId, { timeoutMs: 15_000 })
	} catch {
		// 超时仍写入缓存，避免轮询永久卡住
	}
	if (setFileInfoCache) {
		setFileInfoCache(filePath, {
			src: fileUrl,
			fileName,
		})
	}
}
