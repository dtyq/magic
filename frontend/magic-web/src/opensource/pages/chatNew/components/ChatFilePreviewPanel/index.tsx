import { observer } from "mobx-react-lite"
import { IconX, IconArrowsDiagonal, IconArrowsDiagonalMinimize2 } from "@tabler/icons-react"
import { computed } from "mobx"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"

import { useStyles } from "./styles"

import ChatFileService from "@/opensource/services/chat/file/ChatFileService"
import MessageFilePreviewService from "@/opensource/services/chat/message/MessageFilePreview"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/FilePreviewStore"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { cx } from "antd-style"
import { AntdSkeleton } from "@/opensource/components/base"

const UniverComponent = lazy(() => import("@/opensource/components/UniverComponent"))
const MagicPdfRender = lazy(() => import("@/opensource/components/base/MagicPdfRender"))
const MagicDocxRender = lazy(() => import("@/opensource/components/base/MagicDocxRender"))

const ChatFilePreviewPanel = observer(function ChatFilePreviewPanel({
	className,
	style,
}: {
	className?: string
	style?: React.CSSProperties
}) {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	const isMobile = useIsMobile()

	const previewInfo = MessageFilePreviewStore.previewInfo
	const fileInfo = useMemo(() => {
		return computed(() => {
			if (!previewInfo) return null

			if (previewInfo.src) {
				return {
					download_name: previewInfo.file_name!,
					url: previewInfo.src,
					file_extension: previewInfo.file_extension,
				}
			}

			return ChatFileService.getFileInfoCache(previewInfo.file_id)
		})
	}, [previewInfo]).get()

	const [data, setData] = useState<File | null>(null)
	const [isFullscreen, setIsFullscreen] = useState(false)

	useEffect(() => {
		if (fileInfo?.url) {
			fetch(fileInfo.url)
				.then((res) => res.blob())
				.then((blob) => {
					const file = new File([blob], fileInfo.download_name, { type: blob.type })
					setData(file)
				})
		}
	}, [fileInfo?.download_name, fileInfo?.url])

	// 全屏切换逻辑
	const toggleFullscreen = () => {
		setIsFullscreen(!isFullscreen)
	}

	const Content = () => {
		if (!fileInfo || !data) return <MagicEmpty />

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
			case "doc":
				return <MagicDocxRender file={data} height="100%" minScale={0.3} />
			default:
				return <MagicEmpty description={t("chat.filePreview.notSupportFileType")} />
		}
	}

	return (
		<div
			className={cx(styles.container, isFullscreen && styles.fullscreen, className)}
			style={style}
		>
			<div className={styles.header}>
				<div className={styles.headerLeft}>
					<div className={styles.headerLeftTitle}>
						<span>{t("chat.filePreview.title")}</span>
					</div>
				</div>
				<div className={styles.headerRight}>
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
			<div className={styles.content}>
				<Suspense fallback={null}>{Content()}</Suspense>
			</div>
		</div>
	)
})

export default ChatFilePreviewPanel
