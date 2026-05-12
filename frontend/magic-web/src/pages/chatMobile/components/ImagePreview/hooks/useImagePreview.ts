import { useBoolean, useMemoizedFn } from "ahooks"
import { useEffect, useMemo, useRef, useState } from "react"
import { downloadBlobFile, downloadFile } from "@/utils/file"
import useSendMessage from "@/pages/chatNew/hooks/useSendMessage"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import { Dialog } from "antd-mobile"
import { useTranslation } from "react-i18next"
import ChatFileService from "@/services/chat/file/ChatFileService"
import MessageService from "@/services/chat/message/MessageService"
import { computed } from "mobx"
import { exportMermaidSvgToPngBlob } from "@/utils/mermaidExport"
import { ImagePreviewInfo } from "@/types/chat/preview"
import { useTheme } from "antd-style"
import { isInlineSvgContent, shouldExportSvgAsPng } from "@/utils/svgProcessor"

function useImagePreview(info?: ImagePreviewInfo) {
	const { t } = useTranslation("interface")
	const { magicColorUsages } = useTheme()

	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)
	const [currentImage, setCurrentImage] = useState<string>()
	const [progress, setProgress] = useState<number>(0)

	const timerRef = useRef<NodeJS.Timeout | null>(null)

	const referMessageId = info?.messageId
	const sendMessage = useSendMessage(referMessageId, info?.conversationId)

	const fileInfoInCache = useMemo(() => {
		return computed(() => {
			if (info?.fileId) {
				return ChatFileService.getFileInfoCache(info.fileId)
			}
			return undefined
		})
	}, [info?.fileId]).get()

	const src = useMemo(() => {
		if (info?.fileId && fileInfoInCache) {
			return fileInfoInCache.url
		}
		if (info?.url) {
			return info.url
		}
		return undefined
	}, [fileInfoInCache, info?.fileId, info?.url])

	useEffect(() => {
		if (src) {
			setCurrentImage(src)
		}
	}, [src])

	const updatePercent = useMemoizedFn(() => {
		if (timerRef.current) return

		timerRef.current = setInterval(
			() => {
				setProgress((prevProgress) => {
					let step = Math.ceil(Math.random() * 5)
					if (info?.oldFileId) {
						const activeTimer = timerRef.current
						if (activeTimer) clearInterval(activeTimer)
						timerRef.current = null
						return 100
					}
					step = prevProgress + step >= 99 ? 0 : step
					return Math.min(prevProgress + step, 99)
				})
			},
			50 + Math.random() * 1000,
		)
	})

	const clearTimer = useMemoizedFn(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current)
			timerRef.current = null
		}
	})

	useEffect(() => {
		if (!info?.useHDImage || !loading) {
			setProgress(0)
			return
		}

		if (info?.oldFileId) {
			setProgress(100)
			setLoadingFalse()
			clearTimer()
		} else {
			updatePercent()
		}

		return clearTimer
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [info, loading, setLoadingFalse, updatePercent])

	const navigateToMessage = useMemoizedFn(() => {
		if (info?.messageId) {
			MessageService.focusMessage(info?.messageId)
		}
	})

	const onDownload = useMemoizedFn(async () => {
		try {
			const isSvg = info?.ext?.ext === "svg" || info?.ext?.ext === "svg+xml"
			if (isSvg && currentImage) {
				if (shouldExportSvgAsPng(currentImage)) {
					const pngBlob = await exportMermaidSvgToPngBlob(currentImage)
					await downloadBlobFile(pngBlob, info?.fileName, "png")
					return
				}

				if (isInlineSvgContent(currentImage)) {
					const svgBlob = new Blob([currentImage], {
						type: "image/svg+xml;charset=utf-8",
					})
					await downloadBlobFile(svgBlob, info?.fileName, "svg")
				} else {
					await downloadFile(currentImage, info?.fileName, "svg", {
						forceProxy: true,
					})
				}

				return
			}

			await downloadFile(currentImage, info?.fileName, info?.ext?.ext, {
				forceProxy: true,
			})
		} catch (error) {
			console.error("Image download failed", error)
		}
	})

	const onHighDefinition = useMemoizedFn(async () => {
		if (!src) return
		try {
			await Dialog.confirm({
				title: t("chat.imagePreview.highDefinitionImage"),
				content: t("chat.imagePreview.useHightImageTip"),
				bodyStyle: {
					backgroundColor: magicColorUsages.bg[0],
				},
				onConfirm() {
					setLoadingTrue()
					sendMessage({
						type: ConversationMessageType.Text,
						text: {
							content: "转超清",
							attachments: info?.fileId
								? [
										{
											file_id: info?.fileId,
										},
									]
								: [],
						},
					})
				},
			})
		} catch (error) {
			setLoadingFalse()
		}
	})

	return {
		currentImage,
		loading,
		progress,
		onDownload,
		navigateToMessage,
		onHighDefinition,
	}
}

export default useImagePreview
