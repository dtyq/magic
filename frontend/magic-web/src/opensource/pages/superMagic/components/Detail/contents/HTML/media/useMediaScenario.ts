import { useRef, useMemo, useCallback } from "react"
import {
	findMagicProjectJsFile,
	saveMediaSpeakersAndMagicProjectJs,
	validateMediaSpeakers,
	injectMediaHTMLScript,
	type MediaSpeakersMap,
	type MagicProjectJsFileInfo,
} from "./utils"

interface UseMediaScenarioParams {
	attachmentList?: any[]
	fileId?: string
}

/** 媒体场景类型 */
export type MediaScenarioType = "audio" | "video" | null

export function useMediaScenario({ attachmentList, fileId }: UseMediaScenarioParams) {
	// Media相关状态
	const mediaSpeakers = useRef<MediaSpeakersMap>({})
	const magicProjectJsFileInfo = useRef<MagicProjectJsFileInfo | null>(null)

	// 检测媒体场景类型（audio 或 video）
	const mediaScenarioType = useMemo((): MediaScenarioType => {
		if (!attachmentList || !fileId) return null
		const file = attachmentList.find((item: any) => item.file_id === fileId)
		if (!file?.parent_id) return null
		const parent = attachmentList.find((item: any) => item.file_id === file.parent_id)
		const metadataType = parent?.metadata?.type
		if (metadataType === "audio" || metadataType === "video") {
			return metadataType
		}
		return null
	}, [attachmentList, fileId])

	// 检测是否为media场景（audio或video）
	const isMediaScenario = useMemo(() => {
		return mediaScenarioType === "audio" || mediaScenarioType === "video"
	}, [mediaScenarioType])

	// 加载magic.project.js文件
	const loadMagicProjectJsFile = useCallback(async (): Promise<MagicProjectJsFileInfo | null> => {
		if (!attachmentList || !fileId) return null

		const currentFile = attachmentList.find((item: any) => item.file_id === fileId)
		if (!currentFile) return null

		try {
			const fileInfo = await findMagicProjectJsFile({
				attachments: attachmentList,
				attachmentList: attachmentList,
				currentFileId: fileId,
				currentFileName: currentFile.file_name,
			})

			if (fileInfo) {
				magicProjectJsFileInfo.current = fileInfo
				return fileInfo
			}
			return null
		} catch (error) {
			console.error("Error loading magic.project.js file:", error)
			return null
		}
	}, [attachmentList, fileId])

	// 处理媒体说话人编辑事件
	const handleMediaSpeakerEdit = useCallback(
		async (speakers: MediaSpeakersMap) => {
			if (!isMediaScenario) return

			try {
				if (!validateMediaSpeakers(speakers)) {
					console.warn("Invalid speakers data:", speakers)
					return
				}

				// 更新本地状态
				mediaSpeakers.current = speakers

				// 动态加载magic.project.js文件
				const fileInfo = await loadMagicProjectJsFile()
				if (!fileInfo) {
					console.error("Failed to load magic.project.js file")
					return
				}

				// 直接保存更新后的说话人数据
				await saveMediaSpeakersAndMagicProjectJs({
					mediaSpeakers: speakers,
					magicProjectJsFileInfo: fileInfo,
				})

				console.log("Media speakers saved successfully")
			} catch (error) {
				console.error("Failed to handle media speaker edit:", error)
			}
		},
		[isMediaScenario, loadMagicProjectJsFile],
	)

	// 保存媒体配置（用于手动触发保存）
	const saveMediaConfiguration = useCallback(async () => {
		if (!isMediaScenario) return

		try {
			if (!validateMediaSpeakers(mediaSpeakers.current)) {
				return
			}

			// 动态加载最新的magic.project.js文件
			const fileInfo = await loadMagicProjectJsFile()
			if (!fileInfo) {
				console.error("Failed to load magic.project.js file")
				return
			}

			await saveMediaSpeakersAndMagicProjectJs({
				mediaSpeakers: mediaSpeakers.current,
				magicProjectJsFileInfo: fileInfo,
			})
		} catch (error) {
			console.error("Failed to save media speaker configuration:", error)
		}
	}, [isMediaScenario, loadMagicProjectJsFile])

	// 注入media脚本
	const injectMediaScript = useCallback(
		(content: string): string => {
			if (!isMediaScenario) return content
			return injectMediaHTMLScript(content, fileId)
		},
		[isMediaScenario, fileId],
	)

	return {
		isMediaScenario,
		mediaScenarioType,
		mediaSpeakers,
		magicProjectJsFileInfo,
		injectMediaScript,
		handleMediaSpeakerEdit,
		saveMediaConfiguration,
		loadMagicProjectJsFile,
	}
}

// ============== 兼容旧API的别名导出 ==============

/** @deprecated 使用 useMediaScenario 代替 */
export const useAudioScenario = useMediaScenario
