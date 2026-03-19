import { useBoolean, useMemoizedFn } from "ahooks"
import { useEffect, useMemo, useRef, useState } from "react"
import { downloadFile } from "@/utils/file"
import type { DraggableData, DraggableEvent } from "react-draggable"
import useSendMessage from "@/pages/chatNew/hooks/useSendMessage"
import { ConversationMessageType } from "@/types/chat/conversation_message"
import { Modal } from "antd"
import { useTranslation } from "react-i18next"
import { CompareViewType } from "@/components/base/MagicImagePreview/constants"
import ChatFileService from "@/services/chat/file/ChatFileService"
import MessageService from "@/services/chat/message/MessageService"
import type { ImagePreviewInfo } from "@/types/chat/preview"
import { computed } from "mobx"
import { convertSvgToPng } from "@/utils/image"
import magicToast from "@/components/base/MagicToaster/utils"

const useImageAction = (info?: ImagePreviewInfo) => {
	const { t } = useTranslation("interface")

	const [loading, { setTrue: setLoadingTrue, setFalse: setLoadingFalse }] = useBoolean(false)
	const [isPressing, { setTrue: setPressingTrue, setFalse: setPressingFalse }] = useBoolean(false)

	const [viewType, setViewType] = useState<CompareViewType>(CompareViewType.LONG_PRESS)
	const [currentImage, setCurrentImage] = useState<string>()
	const [progress, setProgress] = useState<number>(0)
	const [disabled, setDisabled] = useState(true)
	const [bounds, setBounds] = useState({ left: 0, top: 0, bottom: 0, right: 0 })

	const draggleRef = useRef<HTMLDivElement>(null)
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

	const isCompare = useMemo(
		() => info?.useHDImage && !!info?.oldUrl,
		[info?.useHDImage, info?.oldUrl],
	)

	const updatePercent = useMemoizedFn(() => {
		if (timerRef.current) return

		timerRef.current = setInterval(
			() => {
				setProgress((prevProgress) => {
					let step = Math.ceil(Math.random() * 5)
					if (info?.oldFileId) {
						clearInterval(timerRef.current!)
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
			// 如果是svg，需要转成 png再下载
			const isSvg = info?.ext?.ext === "svg" || info?.ext?.ext === "svg+xml"
			if (isSvg && currentImage) {
				try {
					const png = await convertSvgToPng(currentImage, 2000, 2000)
					downloadFile(png, info?.fileName, "png", {
						forceProxy: true,
					})
				} catch (error) {
					downloadFile(currentImage, info?.fileName, "svg", {
						forceProxy: true,
					})
				}
			} else {
				downloadFile(currentImage, info?.fileName, info?.ext?.ext)
			}
		} catch (error) {
			if (typeof error === "string") {
				magicToast.error(error)
			} else {
				magicToast.error(t("DownloadFailed", { ns: "message" }))
			}
		}
	})

	const onHighDefinition = useMemoizedFn(async () => {
		if (!src) return
		try {
			Modal.confirm({
				title: t("chat.imagePreview.highDefinitionImage"),
				content: t("chat.imagePreview.useHightImageTip"),
				onOk() {
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

	const onStart = useMemoizedFn((_: DraggableEvent, uiData: DraggableData) => {
		const { clientWidth, clientHeight } = window.document.documentElement
		const targetRect = draggleRef.current?.getBoundingClientRect()
		if (!targetRect) {
			return
		}
		setBounds({
			left: -targetRect.left + uiData.x,
			right: clientWidth - (targetRect.right - uiData.x),
			top: -targetRect.top + uiData.y,
			bottom: clientHeight - (targetRect.bottom - uiData.y),
		})
	})

	const onMouseOver = useMemoizedFn(() => {
		if (disabled) {
			setDisabled(false)
		}
	})

	const onMouseOut = useMemoizedFn(() => {
		setDisabled(true)
	})

	const onLongPressStart = useMemoizedFn(() => {
		timerRef.current = setTimeout(() => {
			setPressingTrue()
		})
	})

	const onLongPressEnd = useMemoizedFn(() => {
		clearTimeout(timerRef.current!)
		timerRef.current = null
		setPressingFalse()
	})

	return {
		currentImage,
		draggleRef,
		loading,
		progress,
		bounds,
		disabled,
		isCompare,
		isPressing,
		viewType,
		setViewType,
		onLongPressStart,
		onLongPressEnd,
		onDownload,
		navigateToMessage,
		onMouseOver,
		onMouseOut,
		onStart,
		onHighDefinition,
	}
}

export default useImageAction
