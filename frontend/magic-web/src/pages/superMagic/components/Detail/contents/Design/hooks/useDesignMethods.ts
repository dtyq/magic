import { useMemo, useCallback } from "react"
import type { Topic, Workspace, ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type {
	CanvasDesignMethods,
	IdentifyImageMarkRequest,
} from "@/components/CanvasDesign/types.magic"
import type { FileItem } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import { SuperMagicApi } from "@/apis"
import { useImageGeneration } from "./useImageGeneration"
import { useImageUpload } from "./useImageUpload"
import { useFileInfoProvider } from "./useFileInfoProvider"
import { useCanvasStorage } from "./useCanvasStorage"
import { useConversationAndDownload } from "./useConversationAndDownload"
import { useHighImageGeneration } from "./useHighImageGeneration"
import { useDesignFileCopy } from "./useDesignFileCopy"
import { clipboard } from "@/utils/clipboard-helpers"
import type { UseDesignDownloadPolicyResult } from "./useDesignDownloadPolicy"

interface UseDesignMethodsOptions {
	projectId?: string
	designProjectId?: string
	selectedTopic?: Topic | null
	currentFile?: {
		id: string
		name: string
	}
	/** 已扁平化的附件列表 */
	flatAttachments?: FileItem[]
	/** 添加文件到 MessageEditor 的回调函数（已废弃，保留以兼容旧代码） */
	onAddFilesToMessageEditor?: (files: File[]) => Promise<void>
	/** 选中的工作区（用于添加到新话题） */
	selectedWorkspace?: Workspace | null
	/** 选中的项目（用于添加到新话题） */
	selectedProject?: ProjectListItem | null
	/** 添加到当前话题后的回调 */
	afterAddFileToCurrentTopic?: () => void
	/** 添加到新话题后的回调 */
	afterAddFileToNewTopic?: () => void
	/** 退出全屏的回调 */
	onExitFullscreen?: () => void | Promise<void>
	/** 文件列表更新 */
	updateAttachments: () => void
	/** 等待附件列表更新完成的回调函数 */
	waitForAttachmentsUpdate: (callback: () => void | Promise<void>) => void
	/** 下载策略（企业版可覆盖） */
	downloadPolicy: UseDesignDownloadPolicyResult
}

/**
 * Canvas Design Methods 聚合器 Hook
 * 职责：组合各个功能 hook，为 CanvasDesign 组件提供统一的 methods 接口
 * - 使用 useImageGeneration 提供图片生成功能
 * - 使用 useImageUpload 提供图片上传功能
 * - 使用 useFileInfoProvider 提供文件信息获取功能
 * - 使用 useCanvasStorage 提供本地存储功能
 * - 使用 useConversationAndDownload 提供添加到对话和下载图片功能
 * - 使用 useDesignFileCopy 提供文件复制到 images 目录功能
 */
export function useDesignMethods(options: UseDesignMethodsOptions): CanvasDesignMethods {
	const {
		projectId,
		designProjectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		onAddFilesToMessageEditor,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		onExitFullscreen,
		updateAttachments,
		waitForAttachmentsUpdate,
		downloadPolicy,
	} = options

	// 使用各个功能 hook（只传递 flatAttachments）
	const { getFileInfo, getFileInfoById, setFileInfoCache } = useFileInfoProvider({
		flatAttachments,
	})

	const { getImageModelList, generateImage, getImageGenerationResult } = useImageGeneration({
		projectId,
		currentFile,
		flatAttachments,
		setFileInfoCache,
		updateAttachments,
		waitForAttachmentsUpdate,
	})

	const { uploadImages, uploadPrivateFiles } = useImageUpload({
		projectId,
		selectedTopic,
		currentFile,
		flatAttachments,
		getFileInfoById,
		updateAttachments,
	})

	const { getStorage, saveStorage, getRootStorage, saveRootStorage } = useCanvasStorage({
		designProjectId,
	})

	const { addToConversation, downloadImage } = useConversationAndDownload({
		flatAttachments,
		onAddFilesToMessageEditor,
		selectedWorkspace,
		selectedProject,
		afterAddFileToCurrentTopic,
		afterAddFileToNewTopic,
		onExitFullscreen,
		downloadPolicy,
	})

	const { generateHightImage, getConvertHightConfig } = useHighImageGeneration({
		projectId,
		currentFile,
	})

	const generateCanvasHightImage: CanvasDesignMethods["generateHightImage"] = useCallback(
		(params) =>
			generateHightImage(params) as ReturnType<CanvasDesignMethods["generateHightImage"]>,
		[generateHightImage],
	)

	const { getDataTransferFileInfo } = useDesignFileCopy({
		projectId,
		currentFile,
		flatAttachments,
		updateAttachments,
	})

	const identifyImageMark = useCallback(
		async (params: IdentifyImageMarkRequest) => {
			return SuperMagicApi.identifyImageMark({
				...params,
				project_id: params.project_id || projectId,
			})
		},
		[projectId],
	)

	// 组合所有方法到 CanvasDesignMethods 接口
	const methods = useMemo<CanvasDesignMethods>(() => {
		return {
			getImageModelList,
			generateImage,
			generateHightImage: generateCanvasHightImage,
			getConvertHightConfig,
			getImageGenerationResult,
			uploadImages,
			getFileInfo,
			addToConversation,
			downloadImage,
			getStorage,
			saveStorage,
			getRootStorage,
			saveRootStorage,
			getDataTransferFileInfo,
			identifyImageMark,
			uploadPrivateFiles,
			clipboard: {
				writeText: clipboard.writeText,
				write: clipboard.write,
				readText: navigator.clipboard?.readText
					? navigator.clipboard.readText.bind(navigator.clipboard)
					: undefined,
				read: navigator.clipboard?.read
					? navigator.clipboard.read.bind(navigator.clipboard)
					: undefined,
			},
		}
	}, [
		getImageModelList,
		generateImage,
		generateCanvasHightImage,
		getConvertHightConfig,
		getImageGenerationResult,
		uploadImages,
		getFileInfo,
		addToConversation,
		downloadImage,
		getStorage,
		saveStorage,
		getRootStorage,
		saveRootStorage,
		getDataTransferFileInfo,
		identifyImageMark,
		uploadPrivateFiles,
	])

	return methods
}
