import { memo, useCallback, useRef, useState } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Download, X } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import type { OpenableProps } from "@/utils/react"
import magicToast from "@/components/base/MagicToaster/utils"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import DownloadAction from "./DownloadAction"

interface FileDownloadModalProps {
	open: boolean
	onClose: () => void
	fileName: string
	downloadUrl: string
	onDownload?: () => void
	onCopyLink?: () => void
	onAfterClose?: () => void
	/** Render the retry as a native link instead of a programmatic download. */
	nativeDownload?: boolean
	/** Target used by the native retry link. */
	downloadTarget?: string
	/** Raises only this detached desktop dialog when it is opened from another modal. */
	modalZIndex?: number
}

/** Renders a lightweight download prompt for downloads triggered outside the normal app tree. */
export default memo(function FileDownloadModal(props: OpenableProps<FileDownloadModalProps>) {
	const {
		open,
		onClose,
		fileName,
		downloadUrl,
		onDownload,
		onCopyLink,
		onAfterClose,
		nativeDownload = false,
		downloadTarget,
		modalZIndex,
	} = props

	// 内部状态管理 open，用于控制关闭动画
	// 由于 openLightModal 每次都创建新实例，open 永远是 true，不需要同步
	const [internalOpen, setInternalOpen] = useState(open)
	const closeStartedRef = useRef(false)

	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	// 处理关闭：先设置内部状态为 false，等动画完成后调用外部 onClose
	const handleClose = useCallback(() => {
		if (closeStartedRef.current) return
		closeStartedRef.current = true
		setInternalOpen(false)
		// 延迟调用 onClose，等待关闭动画
		setTimeout(() => {
			try {
				onAfterClose?.()
			} finally {
				onClose?.()
			}
		}, 200)
	}, [onAfterClose, onClose])

	// Handle download button click
	const handleDownloadClick = useCallback(() => {
		onDownload?.()
		// 不关闭弹窗，让用户可以继续复制链接或手动关闭
	}, [onDownload])

	// Handle copy link button click
	const handleCopyLinkClick = useCallback(() => {
		// 执行复制操作
		if (onCopyLink) {
			onCopyLink()
		} else {
			clipboard.writeText(downloadUrl)
		}

		// 无论哪种方式，都显示成功提示
		magicToast.success(t("share.download.copySuccess"))

		// 不关闭弹窗，让用户可以继续下载或手动关闭
	}, [onCopyLink, downloadUrl, t])

	// ===== Mobile UI =====
	if (isMobile) {
		return (
			<MagicPopup
				visible={internalOpen}
				onClose={handleClose}
				position="bottom"
				bodyClassName="px-4 pb-6"
			>
				{/* Content */}
				<div
					className="flex flex-col items-center gap-4 py-6"
					data-testid="file-download-modal"
				>
					{/* Success Icon */}
					<div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-background p-3 shadow-xs">
						<Download className="h-8 w-8 text-foreground" strokeWidth={1.25} />
					</div>

					{/* Title */}
					<div className="text-center text-lg font-semibold text-foreground">
						{t("share.download.thankYou")}
					</div>

					{/* Instruction */}
					<div className="text-center text-sm text-muted-foreground">
						{t("share.download.downloadInstruction")}
					</div>

					{/* File Info Card */}
					<div className="w-full rounded-lg border-none bg-accent px-4 py-3">
						<div className="flex items-start justify-between gap-3">
							<div className="text-sm text-muted-foreground">
								{t("share.download.fileName")}
							</div>
							<MagicEllipseWithTooltip
								title={fileName}
								text={fileName}
								className="min-w-0 flex-1 text-right text-sm font-medium text-foreground"
								popupContainer={(trigger) => trigger.parentElement ?? document.body}
							>
								{fileName}
							</MagicEllipseWithTooltip>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex w-full flex-col gap-3">
						<DownloadAction
							nativeDownload={nativeDownload}
							downloadUrl={downloadUrl}
							fileName={fileName}
							downloadTarget={downloadTarget}
							onDownload={handleDownloadClick}
							label={t("share.download.downloadFile")}
							className="w-full"
							size="lg"
							data-testid="file-download-modal-download-button"
						/>
						<Button
							onClick={handleCopyLinkClick}
							variant="outline"
							className="w-full"
							size="lg"
							data-testid="file-download-modal-copy-link-button"
						>
							{/* <Copy className="mr-2 h-4 w-4" /> */}
							{t("share.download.copyLink")}
						</Button>
					</div>
				</div>
			</MagicPopup>
		)
	}

	// ===== Desktop UI =====
	return (
		<Dialog open={internalOpen} onOpenChange={(isOpen) => !isOpen && handleClose()}>
			<DialogContent
				className="w-[500px] max-w-[calc(100vw-2rem)] gap-0 p-0 sm:max-w-[500px]"
				// Allow derived desktop modals to opt into a higher layer without changing default downloads.
				style={modalZIndex ? { zIndex: modalZIndex } : undefined}
				showCloseButton={false}
				data-testid="file-download-modal"
				onPointerDownOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				{/* Close Button - 添加关闭按钮 */}
				<button
					onClick={(e) => {
						e.stopPropagation()
						handleClose()
					}}
					className="absolute right-4 top-4 z-50 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
					type="button"
					data-testid="file-download-modal-close-button"
				>
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</button>

				{/* Content */}
				<div className="flex w-full flex-col items-center gap-3 overflow-hidden px-8 py-8 pt-12">
					{/* Success Icon */}
					<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background p-2 shadow-xs">
						<Download className="h-6 w-6 text-foreground" strokeWidth={1.25} />
					</div>

					{/* Message */}
					<div className="flex flex-col gap-1 self-stretch text-center">
						<div className="text-lg font-medium leading-normal text-foreground">
							{t("share.download.thankYou")}
						</div>
						<div className="text-sm leading-normal text-muted-foreground">
							{t("share.download.downloadInstruction")}
						</div>
					</div>

					{/* Info Card */}
					<div className="flex w-full min-w-0 flex-col gap-3 self-stretch rounded-lg bg-accent p-3">
						{/* File Name */}
						<div className="flex w-full min-w-0 items-center justify-between gap-3 self-stretch">
							<div className="text-xs leading-normal text-muted-foreground">
								{t("share.download.fileName")}
							</div>
							<MagicEllipseWithTooltip
								title={fileName}
								text={fileName}
								className="min-w-0 flex-1 text-right text-sm leading-normal text-foreground"
								popupContainer={(trigger) => trigger.parentElement ?? document.body}
							>
								{fileName}
							</MagicEllipseWithTooltip>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex w-full flex-col gap-3">
						<DownloadAction
							nativeDownload={nativeDownload}
							downloadUrl={downloadUrl}
							fileName={fileName}
							downloadTarget={downloadTarget}
							onDownload={handleDownloadClick}
							label={t("share.download.downloadFile")}
							className="w-full gap-2 shadow-xs"
							size="lg"
							data-testid="file-download-modal-download-button"
						/>
						<Button
							variant="outline"
							className="w-full gap-2 shadow-xs"
							onClick={handleCopyLinkClick}
							data-testid="file-download-modal-copy-link-button"
						>
							{/* <Copy className="h-4 w-4" /> */}
							{t("share.download.copyLink")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
})
