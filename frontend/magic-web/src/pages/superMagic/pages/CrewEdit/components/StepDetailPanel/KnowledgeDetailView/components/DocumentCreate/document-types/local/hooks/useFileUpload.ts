import { useKnowledgeFileUpload } from "../../../../../hooks/useKnowledgeFileUpload"

/**
 * 文件上传Hook（Crew知识库-本地文档专用）
 *
 * 这是对通用 useKnowledgeFileUpload 的简单封装，
 * 复用 LocalFile.tsx 中的上传逻辑（基于 useUpload）
 */
export function useFileUpload(onProgressCallback?: (uid: string, progress: number) => void) {
	const {
		fileList: uploadQueue,
		uploadFile: handleFileUpload,
		removeFile,
		clearFiles: clearQueue,
		getSuccessFiles: getUploadedFiles,
	} = useKnowledgeFileUpload({
		storageType: "private",
		onProgress: onProgressCallback,
	})

	return {
		uploadQueue,
		handleFileUpload,
		removeFile,
		clearQueue,
		getUploadedFiles,
	}
}
