import { observer } from "mobx-react-lite"
import { IconX, IconArrowsDiagonal, IconArrowsDiagonalMinimize2 } from "@tabler/icons-react"
import { computed } from "mobx"
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import MagicButton from "@/components/base/MagicButton"
import MagicIcon from "@/components/base/MagicIcon"
import MagicEmpty from "@/components/base/MagicEmpty"
import ChatFileService from "@/services/chat/file/ChatFileService"
import MessageFilePreviewService from "@/services/chat/message/MessageFilePreview"
import MessageFilePreviewStore from "@/stores/chatNew/messagePreview/FilePreviewStore"
import { useIsMobile } from "@/hooks/useIsMobile"
import { AntdSkeleton } from "@/components/base"
import { cn } from "@/utils/cn"

const UniverComponent = lazy(() => import("@/components/UniverComponent"))
const MagicPdfRender = lazy(() => import("@/components/base/MagicPdfRender"))
const MagicDocxRender = lazy(() => import("@/components/base/MagicDocxRender"))

const ChatFilePreviewPanel = observer(function ChatFilePreviewPanel({
	className,
	style,
}: {
	className?: string
	style?: React.CSSProperties
}) {
	const { t } = useTranslation("interface")
	const isMobile = useIsMobile()

	const previewInfo = MessageFilePreviewStore.previewInfo
	const fileInfo = useMemo(() => {
		return computed(() => {
			if (!previewInfo) return null

			if (previewInfo.src) {
				return {
					download_name: previewInfo.file_name ?? "",
					url: previewInfo.src,
					file_extension: previewInfo.file_extension,
				}
			}

			return ChatFileService.getFileInfoCache(previewInfo.file_id)
		})
	}, [previewInfo]).get()

	const [data, setData] = useState<File | null>(null)
	const [resolvedFileInfo, setResolvedFileInfo] = useState<typeof fileInfo>(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const refreshAttemptRef = useRef(false)

	useEffect(() => {
		let cancelled = false
		setResolvedFileInfo(null)
		const resolveFileInfo = async () => {
			if (!previewInfo || previewInfo.src) return fileInfo
			const result = await ChatFileService.fetchFileUrl([
				{
					file_id: previewInfo.file_id,
					message_id: previewInfo.message_id || fileInfo?.message_id || "",
				},
			])
			return result[previewInfo.file_id] ?? fileInfo
		}
		void resolveFileInfo().then((resolved) => {
			if (cancelled) return
			setResolvedFileInfo(resolved)
			if (resolved?.url) {
				const fetchCurrentFile = async () => {
					let response = await fetch(resolved.url)
					if (
						!response.ok &&
						previewInfo &&
						!previewInfo.src &&
						!refreshAttemptRef.current
					) {
						refreshAttemptRef.current = true
						const refreshed = await ChatFileService.fetchFileUrl(
							[
								{
									file_id: previewInfo.file_id,
									message_id: resolved.message_id || "",
								},
							],
							{ forceRefresh: true },
						)
						if (refreshed[previewInfo.file_id]?.url) {
							response = await fetch(refreshed[previewInfo.file_id].url)
						}
					}
					if (!response.ok)
						throw new Error(`File preview request failed: ${response.status}`)
					return response.blob()
				}
				void fetchCurrentFile().then((blob) => {
					if (!cancelled) {
						const file = new File([blob], resolved.download_name, {
							type: blob.type,
						}).catch(() => setData(null))
						setData(file)
					}
				})
			}
		})
		return () => {
			cancelled = true
			setData(null)
		}
	}, [fileInfo, previewInfo])

	useEffect(() => {
		refreshAttemptRef.current = false
	}, [previewInfo?.file_id])

	const effectiveFileInfo = resolvedFileInfo ?? fileInfo

	// 全屏切换逻辑
	const toggleFullscreen = () => {
		setIsFullscreen(!isFullscreen)
	}

	const Content = () => {
		if (!effectiveFileInfo || !data) return <MagicEmpty />

		switch (previewInfo?.file_extension) {
			case "xlsx":
			case "xls":
				return (
					<UniverComponent
						data={data}
						mode="readonly"
						loadingFallback={<AntdSkeleton active paragraph={{ rows: 10 }} />}
					/>
				)
			case "pdf":
				return <MagicPdfRender file={data} height="100%" />
			case "docx":
			case "docm":
			case "doc":
				return <MagicDocxRender file={data} height="100%" minScale={0.3} />
			default:
				return <MagicEmpty description={t("chat.filePreview.notSupportFileType")} />
		}
	}

	return (
		<div
			className={cn(
				"flex h-full flex-col border-l border-border bg-background",
				isFullscreen && "fixed inset-0 z-detail-fullscreen h-screen w-screen border-0",
				className,
			)}
			style={style}
		>
			<div className="flex h-[var(--chat-preview-header-height)] shrink-0 items-center justify-between border-b border-border px-4">
				<div className="flex items-center justify-between">
					<div className="text-base font-semibold">
						<span>{t("chat.filePreview.title")}</span>
					</div>
				</div>
				<div className="flex items-center justify-between gap-2">
					<MagicButton
						hidden={isMobile}
						type="text"
						icon={
							<MagicIcon
								component={
									isFullscreen ? IconArrowsDiagonalMinimize2 : IconArrowsDiagonal
								}
							/>
						}
						onClick={toggleFullscreen}
					/>
					<MagicButton
						type="text"
						icon={<MagicIcon component={IconX} />}
						onClick={MessageFilePreviewService.clearPreviewInfo}
					/>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<Suspense fallback={null}>{Content()}</Suspense>
			</div>
		</div>
	)
})

export default ChatFilePreviewPanel
