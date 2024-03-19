import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useResponsive } from "ahooks"
import { SuperMagicApi } from "@/opensource/apis"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { Switch } from "@/opensource/components/shadcn-ui/switch"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/opensource/components/shadcn-ui/popover"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { IconCopy, IconChevronRight, IconChevronDown } from "@tabler/icons-react"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import CommonPopup from "@/opensource/pages/superMagicMobile/components/CommonPopup"
import { userStore } from "@/opensource/models/user"
import { VipSwitch, VipBadge } from "@/opensource/pages/superMagic/components/VipSwitch"
import { ResourceType, ShareType } from "../Share/types"
import { generateSharePassword } from "../Share/utils"
import { SharePasswordField } from "../Share/ShareFields"
import { useStyles } from "./styles"
import { cn } from "@/opensource/lib/tiptap-utils"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { ShareListRefreshType } from "@/opensource/pages/superMagic/components/ShareManagement/types"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

interface TopicSharePopoverProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	topicId: string
	topicTitle?: string
	children?: React.ReactNode
	onSaveSuccess?: () => void // 保存成功回调
}

interface TopicShareSettings {
	shareEnabled: boolean
	shareUrl: string
	passwordEnabled: boolean
	password: string
	showOriginalInfo: boolean
	showFileList: boolean
	shareType?: ShareType // 保存当前的分享类型
}

function TopicSharePopoverContent({
	topicId,
	topicTitle,
	onSaveSuccess,
	className,
	onDataChanged,
}: {
	topicId: string
	topicTitle?: string
	onSaveSuccess?: () => void
	className?: string
	onDataChanged?: () => void
}) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	// State
	const [settings, setSettings] = useState<TopicShareSettings>({
		shareEnabled: false,
		shareUrl: "",
		passwordEnabled: true,
		password: generateSharePassword(),
		showOriginalInfo: true,
		showFileList: true,
		shareType: ShareType.PasswordProtected,
	})
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

	// Load existing share settings
	useEffect(() => {
		async function loadShareSettings() {
			try {
				const data = await SuperMagicApi.getShareInfoByCode({ code: topicId })
				if (data?.resource_id) {
					const shareUrl = `${window.location.origin}/share/topic/${topicId}`
					setSettings({
						shareEnabled: data.share_type !== ShareType.None,
						shareUrl: data.password
							? `${shareUrl}?password=${data.password}`
							: shareUrl,
						passwordEnabled: !!data.password,
						password: data.password || "",
						showOriginalInfo: data.extra?.show_original_info ?? true,
						showFileList: data.extra?.view_file_list ?? true,
						shareType: data.share_type as ShareType,
					})
				}
			} catch (error) {
				// If no share settings exist, keep default state
				console.log("No existing share settings")
			}
		}

		if (topicId) {
			loadShareSettings()
		}
	}, [topicId])

	// Handle share enable toggle
	const handleShareEnabledChange = useCallback(
		async (checked: boolean) => {
			try {
				if (checked) {
					// Enable share - create share with Public type
					const password = settings.passwordEnabled
						? settings.password || generateSharePassword()
						: ""
					await SuperMagicApi.createShareTopic({
						resource_id: topicId,
						resource_type: ResourceType.Topic,
						share_type: settings.passwordEnabled
							? ShareType.PasswordProtected
							: ShareType.Public,
						password: password,
						extra: {
							show_original_info: settings.showOriginalInfo,
							view_file_list: settings.showFileList,
						},
					})

					const shareUrl = `${window.location.origin}/share/topic/${topicId}`
					const newShareType = settings.passwordEnabled
						? ShareType.PasswordProtected
						: ShareType.Public
					setSettings((prev) => ({
						...prev,
						shareEnabled: true,
						shareUrl: password ? `${shareUrl}?password=${password}` : shareUrl,
						password,
						shareType: newShareType,
					}))
					onSaveSuccess?.()
					onDataChanged?.()
				} else {
					// Disable share
					await SuperMagicApi.cancelShareResource({ resourceId: topicId })
					setSettings((prev) => ({
						...prev,
						shareEnabled: false,
					}))
					onSaveSuccess?.()
					onDataChanged?.()
				}
			} catch (error) {
				console.error("Failed to toggle share:", error)
				magicToast.error(checked ? t("share.createFailed") : t("share.cancelShareFailed"))
			}
		},
		[
			settings.passwordEnabled,
			settings.password,
			settings.showOriginalInfo,
			settings.showFileList,
			topicId,
			t,
			onSaveSuccess,
			onDataChanged,
		],
	)

	// Handle password toggle
	const handlePasswordEnabledChange = useCallback(
		async (checked: boolean) => {
			if (!settings.shareEnabled) {
				setSettings((prev) => ({
					...prev,
					passwordEnabled: checked,
					password: checked ? generateSharePassword() : "",
				}))
				return
			}

			try {
				const password = checked ? generateSharePassword() : ""
				await SuperMagicApi.createShareTopic({
					resource_id: topicId,
					resource_type: ResourceType.Topic,
					share_type: checked ? ShareType.PasswordProtected : ShareType.Public,
					password: password,
					extra: {
						show_original_info: settings.showOriginalInfo,
						view_file_list: settings.showFileList,
					},
				})

				const shareUrl = `${window.location.origin}/share/topic/${topicId}`
				const newShareType = checked ? ShareType.PasswordProtected : ShareType.Public
				setSettings((prev) => ({
					...prev,
					passwordEnabled: checked,
					password,
					shareUrl: password ? `${shareUrl}?password=${password}` : shareUrl,
					shareType: newShareType,
				}))
				onSaveSuccess?.()
				onDataChanged?.()
			} catch (error) {
				console.error("Failed to toggle password:", error)
				magicToast.error(t("share.updateFailed"))
			}
		},
		[
			settings.shareEnabled,
			settings.showOriginalInfo,
			settings.showFileList,
			topicId,
			t,
			onSaveSuccess,
			onDataChanged,
		],
	)

	// Generate share message text
	const shareMessageText = useMemo(() => {
		const displayTopicTitle = topicTitle || t("common.untitledTopic")
		const displayName =
			userStore.user.userInfo?.nickname || userStore.user.userInfo?.real_name || ""
		const lines = [
			t("share.shareMessageTopic"),
			t("share.shareMessageTopicName", { topicTitle: displayTopicTitle }),
			t("share.shareMessageTopicLink", { shareUrl: settings.shareUrl }),
			t("share.shareMessageTopicTip"),
			t("share.createdBy.footerLine", {
				brand: t("share.createdBy.brand"),
				username: displayName,
			}),
		]
		return lines.join("\n")
	}, [topicTitle, settings.shareUrl, t])

	// Render share message with clickable links
	const renderShareMessage = useCallback(() => {
		const lines = shareMessageText.split("\n")
		return (
			<>
				{lines.map((line, index) => {
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
	}, [shareMessageText])

	// Handle copy share message
	const handleCopyShareMessage = useCallback(() => {
		clipboard.writeText(shareMessageText)
		magicToast.success(t("share.copyShareMessageSuccess"))
	}, [shareMessageText, t])

	// Handle copy password
	const handleCopyPassword = useCallback(() => {
		if (settings.password) {
			clipboard.writeText(settings.password)
			magicToast.success(t("share.copyPasswordSuccess"))
		}
	}, [settings.password, t])

	// Handle reset password
	const handleResetPassword = useCallback(async () => {
		if (!settings.shareEnabled || !settings.passwordEnabled) return

		try {
			const newPassword = generateSharePassword()
			await SuperMagicApi.createShareTopic({
				resource_id: topicId,
				resource_type: ResourceType.Topic,
				share_type: ShareType.PasswordProtected,
				password: newPassword,
				extra: {
					show_original_info: settings.showOriginalInfo,
					view_file_list: settings.showFileList,
				},
			})

			const shareUrl = `${window.location.origin}/share/topic/${topicId}`
			setSettings((prev) => ({
				...prev,
				password: newPassword,
				shareUrl: `${shareUrl}?password=${newPassword}`,
			}))
			onSaveSuccess?.()
			onDataChanged?.()
		} catch (error) {
			console.error("Failed to reset password:", error)
			magicToast.error(t("share.resetPasswordFailed"))
		}
	}, [
		settings.shareEnabled,
		settings.passwordEnabled,
		settings.showOriginalInfo,
		settings.showFileList,
		topicId,
		t,
		onSaveSuccess,
		onDataChanged,
	])

	// Handle advanced options change - save immediately
	const handleAdvancedOptionChange = useCallback(
		async (option: "showOriginalInfo" | "showFileList", checked: boolean) => {
			if (!settings.shareEnabled || !settings.shareType) {
				// If share is not enabled, just update local state
				setSettings((prev) => ({
					...prev,
					[option]: checked,
				}))
				return
			}

			try {
				await SuperMagicApi.createOrUpdateShareResource({
					resource_id: topicId,
					resource_type: ResourceType.Topic,
					share_type: settings.shareType,
					password: settings.password || undefined,
					extra: {
						show_original_info:
							option === "showOriginalInfo" ? checked : settings.showOriginalInfo,
						view_file_list: option === "showFileList" ? checked : settings.showFileList,
					},
				})

				setSettings((prev) => ({
					...prev,
					[option]: checked,
				}))
				onSaveSuccess?.()
				onDataChanged?.()
			} catch (error) {
				console.error("Failed to update advanced option:", error)
				magicToast.error(t("share.updateFailed"))
			}
		},
		[
			topicId,
			settings.shareEnabled,
			settings.shareType,
			settings.password,
			settings.showOriginalInfo,
			settings.showFileList,
			t,
			onSaveSuccess,
			onDataChanged,
		],
	)

	return (
		<div className={cn(styles.container, className)}>
			{/* Share Enable Switch */}
			<div className={styles.switchRow}>
				<Switch
					checked={settings.shareEnabled}
					onCheckedChange={handleShareEnabledChange}
				/>
				<div className={styles.switchLabel}>
					<div className={styles.switchTitle}>{t("share.enableShare")}</div>
					<div className={styles.switchDescription}>
						{t("share.enableShareDescription")}
					</div>
				</div>
			</div>

			{settings.shareEnabled && (
				<>
					<Separator />

					{/* Share Message */}
					<div className={styles.fieldGroup}>
						<div className={styles.fieldLabel}>{t("share.shareLink")}</div>
						<div className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm leading-5 text-foreground">
							{renderShareMessage()}
						</div>
						<Button
							size="sm"
							onClick={handleCopyShareMessage}
							className="mt-1 h-8 w-full gap-2"
						>
							<MagicIcon component={IconCopy} size={16} color="#fff" stroke={2} />
							{t("share.copyShareMessage")}
						</Button>
					</div>

					{/* Password Switch */}
					<div className={styles.switchRow}>
						<Switch
							checked={settings.passwordEnabled}
							onCheckedChange={handlePasswordEnabledChange}
						/>
						<div className={styles.switchLabel}>
							<div className={styles.switchTitle}>{t("share.accessPassword")}</div>
						</div>
					</div>

					{/* Password Input (shown when enabled) */}
					{settings.passwordEnabled && (
						<div className={styles.fieldGroup}>
							<SharePasswordField
								password={settings.password}
								onCopy={handleCopyPassword}
								onReset={handleResetPassword}
								showLabel={false}
							/>
						</div>
					)}

					{/* Advanced Options */}
					<div className={styles.advancedSection}>
						<div
							className={styles.advancedHeader}
							onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
						>
							<span className={styles.advancedTitle}>
								{t("share.advancedOptions")}
							</span>
							<MagicIcon
								component={isAdvancedOpen ? IconChevronDown : IconChevronRight}
								size={16}
								stroke={2}
								className="text-foreground"
							/>
						</div>

						{isAdvancedOpen && (
							<div className={styles.advancedContent}>
								{/* Show Original Info - VIP功能 */}
								<div className={styles.switchRow}>
									<VipSwitch
										checked={settings.showOriginalInfo}
										onChange={(checked) =>
											handleAdvancedOptionChange("showOriginalInfo", checked)
										}
									/>
									<div className={styles.switchLabel}>
										<div className="flex items-center gap-2">
											<span className={styles.switchTitle}>
												{t("share.showOriginalInfo")}
											</span>
											<VipBadge />
										</div>
										<div className={styles.switchDescription}>
											{t("share.showOriginalInfoDescription")}
										</div>
									</div>
								</div>

								{/* Show File List - VIP功能 */}
								<div className={styles.switchRow}>
									<VipSwitch
										checked={settings.showFileList}
										onChange={(checked) =>
											handleAdvancedOptionChange("showFileList", checked)
										}
									/>
									<div className={styles.switchLabel}>
										<div className="flex items-center gap-2">
											<span className={styles.switchTitle}>
												{t("share.showFileList")}
											</span>
											<VipBadge />
										</div>
										<div className={styles.switchDescription}>
											{t("share.showFileListDescription")}
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	)
}

function TopicSharePopover({
	open,
	onOpenChange,
	topicId,
	topicTitle,
	children,
	onSaveSuccess,
}: TopicSharePopoverProps) {
	const responsive = useResponsive()
	const isMobile = responsive.md === false
	const hasDataChangedRef = useRef(false)

	// 处理数据变更标记
	const handleDataChanged = useCallback(() => {
		hasDataChangedRef.current = true
	}, [])

	// 处理关闭时的事件发布
	const handleClose = useCallback(
		(newOpen: boolean) => {
			if (!newOpen && hasDataChangedRef.current) {
				// 关闭时如果有数据变更，发布刷新事件
				pubsub.publish(PubSubEvents.Refresh_Share_List, ShareListRefreshType.Topic)
				hasDataChangedRef.current = false
			}
			onOpenChange(newOpen)
		},
		[onOpenChange],
	)

	// 如果没有 children，使用 Dialog 而不是 Popover（用于分享管理面板等场景）
	if (!children) {
		if (isMobile) {
			return (
				<CommonPopup
					title={topicTitle}
					popupProps={{
						visible: open,
						onClose: () => handleClose(false),
						bodyStyle: {
							height: "auto",
						},
					}}
				>
					<TopicSharePopoverContent
						className="p-3.5"
						topicId={topicId}
						topicTitle={topicTitle}
						onSaveSuccess={onSaveSuccess}
						onDataChanged={handleDataChanged}
					/>
				</CommonPopup>
			)
		}

		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="w-[420px] p-3.5" style={{ zIndex: 1500 }}>
					{topicTitle && (
						<DialogHeader>
							<DialogTitle>{topicTitle}</DialogTitle>
						</DialogHeader>
					)}
					<TopicSharePopoverContent
						topicId={topicId}
						topicTitle={topicTitle}
						onSaveSuccess={onSaveSuccess}
						onDataChanged={handleDataChanged}
					/>
				</DialogContent>
			</Dialog>
		)
	}

	// 有 children 时，使用 Popover（用于 MessageHeader 等场景）
	if (isMobile) {
		return (
			<>
				{children}
				<CommonPopup
					title={topicTitle}
					popupProps={{
						visible: open,
						onClose: () => handleClose(false),
						bodyStyle: {
							height: "auto",
						},
					}}
				>
					<TopicSharePopoverContent
						topicId={topicId}
						topicTitle={topicTitle}
						onSaveSuccess={onSaveSuccess}
						onDataChanged={handleDataChanged}
					/>
				</CommonPopup>
			</>
		)
	}

	return (
		<Popover open={open} onOpenChange={handleClose} modal={false}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align="start"
				side="bottom"
				sideOffset={8}
				collisionPadding={16}
				className="w-[420px] p-3.5"
				onInteractOutside={(e) => {
					// 如果点击的是 MagicModal，不要关闭 Popover
					const target = e.target as HTMLElement
					if (target.closest(".ant-modal-root") || target.closest("[role='dialog']")) {
						e.preventDefault()
					}
				}}
			>
				<TopicSharePopoverContent
					topicId={topicId}
					topicTitle={topicTitle}
					onSaveSuccess={onSaveSuccess}
					onDataChanged={handleDataChanged}
				/>
			</PopoverContent>
		</Popover>
	)
}

export default memo(TopicSharePopover)
