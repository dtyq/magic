import { useFileAccess } from "@/pages/superMagic/fileAccess/FileAccessProvider"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { shouldWaitForShareAccess } from "@/pages/superMagic/fileAccess/fileAccessContext"
import { memo, useEffect, useMemo, useState } from "react"
import { Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { IconWorld } from "@tabler/icons-react"
import {
	ChevronLeft,
	ChevronRight,
	FileText,
	Image as ImageIcon,
	Menu,
	Plus,
	RotateCw,
	ShieldCheck,
} from "lucide-react"
import MagicIcon from "@/components/base/MagicIcon"
import { useTranslation } from "react-i18next"
import Markdown from "markdown-to-jsx"
import CommonHeaderV2 from "../../components/CommonHeaderV2"
import type { DetailBrowserAttachment, DetailBrowserData } from "../../types"
import { useStyles } from "./styles"

interface BrowserProps {
	data: DetailBrowserData
	browserAttachments?: DetailBrowserAttachment[]
	userSelectDetail: any
	setUserSelectDetail?: (detail: any) => void
	isFromNode?: boolean
	onClose?: () => void
	// Props from Render component
	type?: string
	currentIndex?: number
	totalFiles?: number
	onPrevious?: () => void
	onNext?: () => void
	onFullscreen?: () => void
	onDownload?: () => void
	hasUserSelectDetail?: boolean
	isFullscreen?: boolean
	// New props for ActionButtons functionality
	viewMode?: "code" | "desktop" | "phone"
	onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	onCopy?: () => void
	onShare?: () => void
	onFavorite?: () => void
	fileContent?: string
	isFavorited?: boolean
	// File sharing props
	topicId?: string
	baseShareUrl?: string
	currentFile?: {
		id: string
		name: string
		type: string
		url?: string
	}
	className?: string
	selectedProject?: any
	allowEdit?: boolean
}

export default memo(function Browser(props: BrowserProps) {
	const {
		data,
		browserAttachments = [],
		isFromNode,
		// Props from Render component
		type,
		onFullscreen,
		onDownload,
		isFullscreen,
		// New props for ActionButtons functionality
		viewMode,
		onViewModeChange,
		onCopy,
		fileContent,
		// File sharing props
		currentFile,
		className,
		allowEdit,
	} = props
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")
	const fileAccess = useFileAccess()
	const fileApi = useFileApi()
	const { url, title, page_title, file_id, file_key, detail } = data || {}
	const hasUrl = typeof url === "string" && url.trim().length > 0
	const displayUrl = hasUrl ? url : t("browserDetail.addressUnavailable")
	const displayTitle = title || page_title || (hasUrl ? url : t("browserDetail.untitledWebpage"))
	const matchedAttachment = useMemo(
		() => browserAttachments.find((attachment) => attachment.file_key === file_key),
		[browserAttachments, file_key],
	)
	const snapshotUrl = matchedAttachment?.file_url || ""
	const resolvedFileId = matchedAttachment?.file_id || file_id || ""
	const [imgSrc, setImgSrc] = useState("")
	const [imageError, setImageError] = useState(false)
	const [fallbackToDetail, setFallbackToDetail] = useState(false)
	const hasDetail = Boolean(detail?.trim())
	const hasScreenshot = Boolean(resolvedFileId || snapshotUrl)
	const showViewSwitcher = hasScreenshot && hasDetail
	const showDetail = hasDetail && (!hasScreenshot || viewMode === "code" || fallbackToDetail)

	// 回调变化不代表截图变化；保持加载依赖稳定，失败时仍通知最新的父组件回调。
	const switchToTextDetail = useMemoizedFn((): void => {
		onViewModeChange?.("code")
	})

	const onOpenUrl = hasUrl
		? () => {
				window.open(url, "_blank", "noopener,noreferrer")
			}
		: undefined

	useEffect(() => {
		let cancelled = false
		setImageError(false)
		setFallbackToDetail(false)
		setImgSrc("")

		if (shouldWaitForShareAccess(fileAccess)) {
			return () => {
				cancelled = true
			}
		}

		if (!resolvedFileId) {
			setImgSrc(snapshotUrl)
			if (!snapshotUrl && hasDetail) {
				setImageError(true)
				setFallbackToDetail(true)
				switchToTextDetail()
			}
			return () => {
				cancelled = true
			}
		}

		fileApi
			.getTemporaryDownloadUrl({
				file_ids: [resolvedFileId],
				enableErrorMessagePrompt: false,
			})
			.then((res: Array<{ url?: string }> = []) => {
				if (cancelled) return
				const source = res[0]?.url || snapshotUrl
				setImgSrc(source)
				if (!source && hasDetail) {
					setImageError(true)
					setFallbackToDetail(true)
					switchToTextDetail()
				}
			})
			.catch(() => {
				if (cancelled) return
				setImgSrc(snapshotUrl)
				if (!snapshotUrl && hasDetail) {
					setImageError(true)
					setFallbackToDetail(true)
					switchToTextDetail()
				}
			})

		return () => {
			cancelled = true
		}
	}, [fileAccess, fileApi, hasDetail, switchToTextDetail, resolvedFileId, snapshotUrl])

	const handleImageError = () => {
		setImageError(true)
		if (hasDetail) {
			setFallbackToDetail(true)
			onViewModeChange?.("code")
		}
	}

	const handleViewModeChange = (mode: "desktop" | "code") => {
		setFallbackToDetail(false)
		onViewModeChange?.(mode)
	}

	const tabTitle = displayTitle

	return (
		<div className={cx(styles.browserContainer, className)}>
			<div className={styles.chrome}>
				<div className={styles.tabBar}>
					<div className={styles.windowControls} aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
					<div className={styles.activeTab} title={tabTitle}>
						<MagicIcon component={IconWorld} size={14} stroke={1.8} />
						<span>{tabTitle}</span>
						<span className={styles.tabClose} aria-hidden="true">
							×
						</span>
					</div>
					<Flex className={styles.tabActions} align="center" gap={4}>
						<span className={styles.nonInteractiveControl} aria-hidden="true">
							<Plus size={16} strokeWidth={1.7} />
						</span>
						{showViewSwitcher && (
							<div className={styles.viewModeSwitcher} role="group">
								<button
									type="button"
									className={cx(
										styles.viewModeButton,
										!showDetail && styles.viewModeButtonActive,
									)}
									onClick={() => handleViewModeChange("desktop")}
									aria-pressed={!showDetail}
								>
									<ImageIcon size={16} />
									<span>{t("browserDetail.screenshot")}</span>
								</button>
								<button
									type="button"
									className={cx(
										styles.viewModeButton,
										showDetail && styles.viewModeButtonActive,
									)}
									onClick={() => handleViewModeChange("code")}
									aria-pressed={showDetail}
								>
									<FileText size={16} />
									<span>{t("browserDetail.detail")}</span>
								</button>
							</div>
						)}
						<CommonHeaderV2
							type={type}
							renderMode="actions"
							onFullscreen={onFullscreen}
							onDownload={onDownload}
							isFromNode={isFromNode}
							isFullscreen={isFullscreen}
							viewMode={viewMode}
							onViewModeChange={onViewModeChange}
							onCopy={onCopy}
							fileContent={fileContent || (hasUrl ? url : "")}
							currentFile={currentFile}
							onOpenUrl={onOpenUrl}
							allowEdit={allowEdit}
						/>
						<span className={styles.nonInteractiveControl} aria-hidden="true">
							<Menu size={16} strokeWidth={1.7} />
						</span>
					</Flex>
				</div>
				<div className={styles.toolbar}>
					<div className={styles.navigationControls} aria-hidden="true">
						<ChevronLeft size={16} strokeWidth={1.8} />
						<ChevronRight size={16} strokeWidth={1.8} />
						<RotateCw size={15} strokeWidth={1.8} />
					</div>
					<div className={styles.addressBar} title={displayUrl}>
						<ShieldCheck size={15} strokeWidth={1.8} />
						<span>{displayUrl}</span>
					</div>
				</div>
			</div>
			<div className={styles.content}>
				{showDetail ? (
					<div className={styles.detailContent} data-testid="browser-detail">
						<Markdown options={{ disableParsingRawHTML: true }}>
							{detail || ""}
						</Markdown>
					</div>
				) : imgSrc && !imageError ? (
					<img
						className={styles.screenshot}
						src={imgSrc}
						alt={displayTitle}
						data-testid="browser-image"
						onError={handleImageError}
					/>
				) : imageError ? (
					<div className={styles.imageError} role="status">
						<div>{t("waterfallCard.imageUnavailable")}</div>
					</div>
				) : null}
			</div>
		</div>
	)
})
