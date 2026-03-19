import { memo, useCallback, useState } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent } from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Download, Copy, X } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import type { OpenableProps } from "@/utils/react"
import magicToast from "@/components/base/MagicToaster/utils"
import MagicEllipseWithTooltip from "@/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"

interface FileDownloadModalProps {
	open: boolean
	onClose: () => void
	fileName: string
	downloadUrl: string
	onDownload?: () => void
	onCopyLink?: () => void
}

export default memo(function FileDownloadModal(props: OpenableProps<FileDownloadModalProps>) {
	const { open, onClose, fileName, downloadUrl, onDownload, onCopyLink } = props

	// 内部状态管理 open，用于控制关闭动画
	// 由于 openLightModal 每次都创建新实例，open 永远是 true，不需要同步
	const [internalOpen, setInternalOpen] = useState(open)

	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	// 处理关闭：先设置内部状态为 false，等动画完成后调用外部 onClose
	const handleClose = useCallback(() => {
		setInternalOpen(false)
		// 延迟调用 onClose，等待关闭动画
		setTimeout(() => {
			onClose?.()
		}, 200)
	}, [onClose])

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
				<div className="flex flex-col items-center gap-4 py-6">
					{/* Success Icon */}
					<div className="shadow-xs flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-background p-3">
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
						<Button onClick={handleDownloadClick} className="w-full" size="lg">
							{/* <Download className="mr-2 h-4 w-4" /> */}
							{t("share.download.downloadFile")}
						</Button>
						<Button
							onClick={handleCopyLinkClick}
							variant="outline"
							className="w-full"
							size="lg"
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
				style={{ zIndex: 1200 }}
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
				>
					<X className="h-4 w-4" />
					<span className="sr-only">Close</span>
				</button>

				{/* Content */}
				<div className="flex w-full flex-col items-center gap-3 overflow-hidden px-8 py-8 pt-12">
					{/* Success Icon */}
					<div className="shadow-xs flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background p-2">
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
						<Button
							variant="default"
							className="shadow-xs w-full gap-2"
							onClick={handleDownloadClick}
						>
							{/* <Download className="h-4 w-4" /> */}
							{t("share.download.downloadFile")}
						</Button>
						<Button
							variant="outline"
							className="shadow-xs w-full gap-2"
							onClick={handleCopyLinkClick}
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
