import { memo, useCallback, useMemo, useRef, useState } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { QRCode } from "antd"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Label } from "@/opensource/components/shadcn-ui/label"
import { Copy, Download } from "lucide-react"
import { IconShare3, IconDots } from "@tabler/icons-react"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import CommonPopup from "@/opensource/pages/superMagicMobile/components/CommonPopup"
import ActionsPopupComponent from "@/opensource/pages/superMagicMobile/components/ActionsPopup"
import type { ActionsPopup } from "@/opensource/pages/superMagicMobile/components/ActionsPopup/types"
import MobileButton from "@/opensource/pages/superMagicMobile/components/MobileButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import MagicModal from "@/opensource/components/base/MagicModal"
import { createStyles } from "antd-style"
import { openShareManagementModal } from "@/opensource/pages/superMagic/components/ShareManagement/openShareManagementModal"
import { SharedResourceType } from "@/opensource/pages/superMagic/components/ShareManagement/types"
import MagicEllipseWithTooltip from "@/opensource/components/base/MagicEllipseWithTooltip/MagicEllipseWithTooltip"
import {
	getRemainingDays,
	formatExpireAt,
} from "@/opensource/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { downloadFile } from "@/opensource/utils/file"
import { userStore } from "@/opensource/models/user"
import { downloadFileWithAnchor } from "../../../utils/handleFIle"
import { useFileDisplayConfig } from "../hooks/useFileDisplayConfig"

interface ShareSuccessModalProps {
	open: boolean
	onClose: () => void
	onCancelShare?: () => void
	onEditShare?: () => void
	shareName: string
	fileCount: number
	mainFileName: string
	shareUrl: string
	password?: string
	expire_at?: string // 过期时间（格式：xxxx/xx/xx 或 xxxx/xx/xx xx:xx:xx）
	shareType: number
	shareProject?: boolean // 是否分享整个项目
	projectName?: string // 项目原始名称（用于项目分享时显示）
	fileIds?: string[] // 文件ID列表，用于查询文件详情
}

const useStyles = createStyles(({ token }) => ({
	mobileContainer: {
		display: "flex",
		flexDirection: "column",
		gap: 12,
		padding: 16,
	},
	mobileHeader: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: 12,
	},
	mobileIconWrapper: {
		display: "flex",
		width: 48,
		height: 48,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 8,
		border: `1px solid ${token.colorBorder}`,
		background: token.colorBgContainer,
	},
	mobileTitle: {
		fontSize: 18,
		fontWeight: 500,
		color: token.colorText,
		textAlign: "center" as const,
	},
	mobileSubtitle: {
		fontSize: 14,
		color: token.colorTextSecondary,
		textAlign: "center" as const,
	},
	mobileInfoCard: {
		display: "flex",
		flexDirection: "column",
		gap: 12,
		padding: 12,
		borderRadius: 8,
		background: token.colorFillQuaternary,
	},
	mobileInfoRow: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		gap: 12,
	},
	mobileInfoLabel: {
		fontSize: 12,
		color: token.colorTextSecondary,
		flexShrink: 0,
	},
	mobileInfoValue: {
		fontSize: 14,
		color: token.colorText,
		textAlign: "right" as const,
		wordBreak: "break-all" as const,
	},
	mobileShareLinkSection: {
		display: "flex",
		flexDirection: "column",
		gap: 8,
	},
	mobileLabel: {
		fontSize: 14,
		fontWeight: 500,
		color: token.colorText,
		alignSelf: "flex-start" as const,
	},
	mobileShareLinkBox: {
		padding: 12,
		borderRadius: 8,
		border: `1px solid ${token.colorBorder}`,
		background: token.colorBgContainer,
		fontSize: 14,
		color: token.colorText,
		whiteSpace: "pre-wrap" as const,
		wordBreak: "break-all" as const,
		overflowY: "auto" as const,
	},
	mobileCopyButton: {
		width: "100%",
		height: 44,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		borderRadius: 8,
		background: "#171717",
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: 500,
		cursor: "pointer",
	},
	mobileQRCodeSection: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: 8,
	},
	mobileQRCodeWrapper: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		padding: 12,
		borderRadius: 8,
		border: `1px solid ${token.colorBorder}`,
		background: token.colorBgContainer,
		width: "100%",
	},
	mobileDownloadButton: {
		width: "100%",
		height: 44,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		borderRadius: 8,
		border: `1px solid ${token.colorBorder}`,
		background: token.colorBgContainer,
		color: token.colorText,
		fontSize: 14,
		fontWeight: 500,
		cursor: "pointer",
	},
	headerDotsButton: {
		width: "24px !important",
		height: "24px !important",
	},
}))

export default memo(function ShareSuccessModal(props: ShareSuccessModalProps) {
	const {
		open,
		onClose,
		onCancelShare,
		onEditShare,
		shareName,
		fileCount,
		mainFileName,
		shareUrl,
		password,
		expire_at,
		shareType,
		shareProject,
		projectName,
		fileIds,
	} = props

	// 使用 hook 获取文件详情配置
	const { fileDisplayConfig, loading: fileConfigLoading } = useFileDisplayConfig(fileIds)

	const { t } = useTranslation("super")
	const { styles } = useStyles()
	const qrCodeRef = useRef<HTMLDivElement>(null)
	const isMobile = useIsMobile()
	const [actionsPopupVisible, setActionsPopupVisible] = useState(false)

	// ===== 共享的计算逻辑 =====

	// Calculate expiry date text
	const expiryText = useMemo(() => {
		if (!expire_at) {
			return t("shareManagement.permanentValid")
		}
		// 计算剩余天数
		const remainingDays = getRemainingDays(expire_at)
		if (remainingDays === null) {
			return t("shareManagement.permanentValid")
		}
		if (remainingDays === 0) {
			return t("shareManagement.expired")
		}
		// 格式化 expire_at：从 "xxxx/xx/xx xx:xx:xx" 转为 "xxxx/xx/xx xx:xx"
		const formattedDate = formatExpireAt(expire_at)
		return t("shareManagement.validUntil", {
			days: remainingDays,
			date: formattedDate,
		})
	}, [expire_at, t])

	// Get share type text
	const shareTypeText = useMemo(() => {
		switch (shareType) {
			case 2:
				return t("share.teamShare")
			case 4:
				return t("share.publicAccess")
			case 5:
				return t("share.passwordProtected")
			default:
				return t("share.publicAccess")
		}
	}, [shareType, t])

	// Generate file summary text
	const fileSummaryText = useMemo(() => {
		// 如果是单个文件，显示文件名
		if (fileCount === 1) {
			return mainFileName
		}
		// 多个文件，显示文件摘要
		return t("share.fileCountSummary", { mainFileName, count: fileCount })
	}, [fileCount, mainFileName, t])

	// Generate share message text
	const shareMessageText = useMemo(() => {
		const lines = []

		// 优先检查特殊项目类型（不受 fileCount 限制）
		const fileType = fileDisplayConfig?.type
		const isSpecialProject =
			fileType === "audio" ||
			fileType === "dashboard" ||
			fileType === "design" ||
			fileType === "slide"

		if (shareProject) {
			// 项目分享 - 优先使用 projectName，否则使用 shareName
			const displayProjectName = projectName || t("common.untitledProject")
			lines.push(t("share.shareMessageProject"))
			lines.push(t("share.shareMessageProjectName", { projectName: displayProjectName }))
			lines.push(t("share.shareMessageProjectLink", { shareUrl }))
			lines.push(t("share.shareMessageProjectTip"))
		} else if (isSpecialProject) {
			// 特殊项目分享（audio/dashboard/design/slide）- 不限制文件数
			if (fileType === "audio") {
				lines.push(t("share.shareMessageAudio"))
			} else if (fileType === "dashboard") {
				lines.push(t("share.shareMessageDashboard"))
			} else if (fileType === "design") {
				lines.push(t("share.shareMessageDesign"))
			} else if (fileType === "slide") {
				lines.push(t("share.shareMessageSlide"))
			}

			lines.push(t("share.shareMessageSingleFileFile", { fileName: mainFileName }))
			lines.push(t("share.shareMessageSingleFileLink", { shareUrl }))
			lines.push(t("share.shareMessageSingleFileTip"))
		} else if (fileCount === 1) {
			// 单个普通文件分享
			lines.push(t("share.shareMessageSingleFile"))
			lines.push(t("share.shareMessageSingleFileFile", { fileName: mainFileName }))
			lines.push(t("share.shareMessageSingleFileLink", { shareUrl }))
			lines.push(t("share.shareMessageSingleFileTip"))
		} else {
			// 多个文件分享
			lines.push(t("share.shareMessageMultipleFiles", { count: fileCount }))
			lines.push(t("share.shareMessageMultipleFilesLink", { shareUrl }))
			lines.push(t("share.shareMessageMultipleFilesTip"))
		}

		const displayName =
			userStore.user.userInfo?.nickname || userStore.user.userInfo?.real_name || ""
		lines.push(
			t("share.createdBy.footerLine", {
				brand: t("share.createdBy.brand"),
				username: displayName,
			}),
		)

		return lines.join("\n")
	}, [fileCount, mainFileName, projectName, shareProject, shareUrl, t, fileDisplayConfig])

	// Render share message with clickable links
	const renderShareMessage = useCallback(() => {
		// 如果正在加载且是单文件分享，显示 loading 状态
		if (fileConfigLoading && fileIds?.length === 1) {
			return (
				<div className="flex items-center justify-center py-8 text-muted-foreground">
					<span className="animate-pulse">{t("common.loading")}...</span>
				</div>
			)
		}

		const lines = shareMessageText.split("\n")
		return (
			<>
				{lines.map((line, index) => {
					// 检测是否包含 URL
					const urlMatch = line.match(/(https?:\/\/[^\s]+)/)
					if (urlMatch) {
						const parts = line.split(urlMatch[0])
						return (
							<div key={index} className="break-words">
								{parts[0]}
								<a
									href={urlMatch[0]}
									target="_blank"
									rel="noopener noreferrer"
									className="inline break-all text-primary underline"
									onClick={(e) => e.stopPropagation()}
								>
									{urlMatch[0]}
								</a>
								{parts[1]}
							</div>
						)
					}
					return <div key={index}>{line}</div>
				})}
			</>
		)
	}, [shareMessageText, fileConfigLoading, fileIds, t])

	// ===== 共享的事件处理 =====

	// Handle copy share link
	const handleCopyShareLink = useCallback(() => {
		clipboard.writeText(shareMessageText)
		magicToast.success(t("share.copySuccess"))
	}, [shareMessageText, t])

	// Handle download QR code
	const handleDownloadQRCode = useCallback(async () => {
		const canvas = qrCodeRef.current?.querySelector("canvas")
		if (!canvas) return

		const filename = `${shareName || "share"}-qrcode.jpeg`

		if (isMobile) {
			// 移动端使用 toDataURL 方式，兼容性更好
			try {
				canvas.toBlob(async (blob) => {
					if (!blob) return
					const url = URL.createObjectURL(blob)
					const result = await downloadFile(url, filename, "jpeg")

					if (result.success) {
						magicToast.success(t("share.downloadSuccess"))
					} else {
						magicToast.error(result.message || t("share.downloadFailed"))
					}
				})
			} catch (error) {
				console.error("Download QR code failed:", error)
				magicToast.error(t("share.downloadFailed"))
			}
		} else {
			// PC端使用 toBlob 方式
			canvas.toBlob((blob) => {
				if (!blob) return
				const url = URL.createObjectURL(blob)
				downloadFileWithAnchor(url, filename)
				magicToast.success(t("share.downloadSuccess"))
			})
		}
	}, [shareName, isMobile, t])

	// Handle cancel share with confirmation
	const handleCancelShareClick = useCallback(() => {
		if (!onCancelShare) return

		MagicModal.confirm({
			title: t("shareManagement.cancelShareConfirmTitle"),
			content: t("shareManagement.cancelShareConfirmContent"),
			onOk: () => {
				onCancelShare()
			},
			okText: t("shareManagement.confirmCancel"),
			cancelText: t("common.cancel"),
			okButtonProps: {
				variant: "destructive",
			},
			zIndex: 1300, // 确保在 ShareSuccessModal 之上
		})
	}, [onCancelShare, t])

	// ===== Mobile 特有的逻辑 =====

	// Mobile actions popup config
	const mobileActions = useMemo<ActionsPopup.ActionButtonConfig[]>(
		() => [
			{
				key: "manageShare",
				label: t("share.manageShareLinks"),
				onClick: () => {
					setActionsPopupVisible(false)
					// 根据 shareProject 决定打开的 tab
					const defaultTab = shareProject
						? SharedResourceType.Project
						: SharedResourceType.File
					openShareManagementModal(undefined, { defaultTab })
					onClose()
				},
			},
		],
		[t, shareProject, onClose],
	)

	const handleOpenActionsPopup = useCallback(() => {
		setActionsPopupVisible(true)
	}, [])

	const handleCloseActionsPopup = useCallback(() => {
		setActionsPopupVisible(false)
	}, [])

	// ===== Mobile UI =====
	if (isMobile) {
		return (
			<>
				<CommonPopup
					title={t("share.shareInfo")}
					headerExtra={
						<MobileButton
							borderDisabled={open}
							className={styles.headerDotsButton}
							onClick={handleOpenActionsPopup}
						>
							<MagicIcon size={22} stroke={2} component={IconDots} />
						</MobileButton>
					}
					popupProps={{
						visible: open,
						onClose,
						onMaskClick: onClose, // 移动端允许点击 mask 关闭
						showCloseButton: false,
					}}
				>
					<div className={styles.mobileContainer}>
						{/* Header with icon and message */}
						<div className={styles.mobileHeader}>
							<div className={styles.mobileIconWrapper}>
								<IconShare3 size={28} strokeWidth={1} />
							</div>
							<div className={styles.mobileTitle}>
								{shareProject
									? t("share.projectShareGenerated")
									: t("share.shareLinkGenerated")}
							</div>
							<div className={styles.mobileSubtitle}>
								{t("share.fileReadyToShare")}
							</div>
						</div>

						{/* Info Card */}
						<div className={styles.mobileInfoCard}>
							<div className={styles.mobileInfoRow}>
								<div className={styles.mobileInfoLabel}>{t("share.shareName")}</div>
								<MagicEllipseWithTooltip
									title={shareName}
									text={shareName}
									className={styles.mobileInfoValue}
								>
									{shareName}
								</MagicEllipseWithTooltip>
							</div>
							<div className={styles.mobileInfoRow}>
								<div className={styles.mobileInfoLabel}>
									{t("share.includedFiles")}
								</div>
								<MagicEllipseWithTooltip
									title={fileSummaryText}
									text={fileSummaryText}
									className={styles.mobileInfoValue}
								>
									{fileSummaryText}
								</MagicEllipseWithTooltip>
							</div>
							<div className={styles.mobileInfoRow}>
								<div className={styles.mobileInfoLabel}>
									{t("share.shareExpiry")}
								</div>
								<MagicEllipseWithTooltip
									title={expiryText}
									text={expiryText}
									className={styles.mobileInfoValue}
								>
									{expiryText}
								</MagicEllipseWithTooltip>
							</div>
							<div className={styles.mobileInfoRow}>
								<div className={styles.mobileInfoLabel}>
									{t("share.shareMethod")}
								</div>
								<MagicEllipseWithTooltip
									title={shareTypeText}
									text={shareTypeText}
									className={styles.mobileInfoValue}
								>
									{shareTypeText}
								</MagicEllipseWithTooltip>
							</div>
						</div>

						{/* Share Link Section */}
						<div className={styles.mobileShareLinkSection}>
							<div className={styles.mobileLabel}>{t("share.shareLink")}</div>
							<div className={styles.mobileShareLinkBox}>{renderShareMessage()}</div>
							<div className={styles.mobileCopyButton} onClick={handleCopyShareLink}>
								<Copy size={16} />
								{t("share.copy")}
							</div>
						</div>

						{/* QR Code Section */}
						<div className={styles.mobileQRCodeSection}>
							<div className={styles.mobileLabel}>{t("share.qrCode")}</div>
							<div ref={qrCodeRef} className={styles.mobileQRCodeWrapper}>
								<QRCode
									value={shareUrl}
									size={120}
									bordered={false}
									bgColor="#FFFFFF"
								/>
							</div>
							<div
								className={styles.mobileDownloadButton}
								onClick={handleDownloadQRCode}
							>
								<Download size={16} />
								{t("share.downloadQRCode")}
							</div>
						</div>
					</div>
				</CommonPopup>

				{/* Actions Popup for mobile */}
				<ActionsPopupComponent
					visible={actionsPopupVisible}
					title={t("shareManagement.more")}
					actions={mobileActions}
					onClose={handleCloseActionsPopup}
				/>
			</>
		)
	}

	// ===== Desktop UI =====
	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent
				className="w-[600px] max-w-[calc(100vw-2rem)] gap-0 p-0 sm:max-w-[600px]"
				style={{ zIndex: 1200 }}
				onPointerDownOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				{/* Header */}
				<DialogHeader className="border-b border-border px-3 py-3">
					<DialogTitle className="text-base font-semibold">
						{t("share.successModalTitle")}
					</DialogTitle>
				</DialogHeader>

				{/* Content */}
				<div className="flex flex-col items-center gap-3 px-8 py-8">
					{/* Success Icon */}
					<div className="shadow-xs flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background p-2">
						<IconShare3 className="h-7 w-7 text-foreground" strokeWidth={1} />
					</div>

					{/* Message */}
					<div className="flex flex-col gap-1 self-stretch text-center">
						<div className="text-lg font-medium leading-normal text-foreground">
							{shareProject
								? t("share.projectShareGenerated")
								: t("share.shareLinkGenerated")}
						</div>
						<div className="text-sm leading-normal text-muted-foreground">
							{t("share.fileReadyToShare")}
						</div>
					</div>

					{/* Info Card */}
					<div className="flex flex-col gap-3 self-stretch rounded-lg bg-muted p-3">
						{/* Share Name */}
						<div className="flex items-center justify-between gap-3 self-stretch">
							<div className="text-xs leading-normal text-muted-foreground">
								{t("share.shareName")}
							</div>
							<div className="text-sm leading-normal text-foreground">
								{shareName}
							</div>
						</div>

						{/* Included Files */}
						<div className="flex items-center justify-between gap-3 self-stretch">
							<div className="text-xs leading-normal text-muted-foreground">
								{t("share.includedFiles")}
							</div>
							<div className="text-sm leading-normal text-foreground">
								{fileSummaryText}
							</div>
						</div>

						{/* Expiry */}
						<div className="flex items-center justify-between gap-3 self-stretch">
							<div className="text-xs leading-normal text-muted-foreground">
								{t("share.shareExpiry")}
							</div>
							<div className="text-sm leading-normal text-foreground">
								{expiryText}
							</div>
						</div>

						{/* Share Method */}
						<div className="flex items-center justify-between gap-3 self-stretch">
							<div className="text-xs leading-normal text-muted-foreground">
								{t("share.shareMethod")}
							</div>
							<div className="text-sm leading-normal text-foreground">
								{shareTypeText}
							</div>
						</div>
					</div>

					{/* Share Link and QR Code Section */}
					<div className="flex gap-3 self-stretch">
						{/* Share Link */}
						<div className="flex flex-1 flex-col gap-2">
							<a
								href={shareUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm font-medium leading-none text-foreground hover:underline"
							>
								{t("share.shareLink")}
							</a>
							<div className="shadow-xs h-[144px] w-[380px] overflow-y-auto whitespace-pre-wrap text-wrap break-words rounded-lg border border-border bg-background px-3 py-2 text-sm leading-normal text-foreground">
								{renderShareMessage()}
							</div>
							<Button
								variant="outline"
								className="shadow-xs w-full gap-2"
								onClick={handleCopyShareLink}
							>
								<Copy className="h-4 w-4" />
								{t("share.copy")}
							</Button>
						</div>

						{/* QR Code */}
						<div className="flex flex-col gap-2">
							<Label className="text-sm font-medium leading-none">
								{t("share.qrCode")}
							</Label>
							<div
								ref={qrCodeRef}
								className="shadow-xs flex h-[144px] w-[144px] items-center justify-center rounded-lg border border-border bg-background p-3"
							>
								<QRCode
									value={shareUrl}
									size={120}
									bordered={false}
									bgColor="#FFFFFF"
								/>
							</div>
							<Button
								variant="outline"
								className="shadow-xs w-[144px] gap-2"
								onClick={handleDownloadQRCode}
							>
								<Download className="h-4 w-4" />
								{t("share.downloadQRCode")}
							</Button>
						</div>
					</div>
				</div>

				{/* Footer */}
				<DialogFooter className="border-t border-border px-3 py-3">
					<div className="flex w-full items-center justify-between gap-1.5">
						<Button
							variant="outline"
							onClick={() => {
								// 根据 shareProject 决定打开的 tab
								const defaultTab = shareProject
									? SharedResourceType.Project
									: SharedResourceType.File
								openShareManagementModal(undefined, { defaultTab })
								onClose()
							}}
							className="shadow-xs"
						>
							{t("share.manageShareLinks")}
						</Button>
						<div className="flex items-center gap-1.5">
							{onCancelShare && (
								<Button
									variant="ghost"
									onClick={handleCancelShareClick}
									className="text-destructive hover:text-destructive"
								>
									{t("share.cancelShare")}
								</Button>
							)}
							{onEditShare && (
								<Button
									variant="outline"
									onClick={onEditShare}
									className="shadow-xs"
								>
									{t("share.editShare")}
								</Button>
							)}
						</div>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
})
