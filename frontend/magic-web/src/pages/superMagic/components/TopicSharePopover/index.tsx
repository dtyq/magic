import { memo, useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SuperMagicApi } from "@/apis"
import { clipboard } from "@/utils/clipboard-helpers"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Switch } from "@/components/shadcn-ui/switch"
import { Separator } from "@/components/shadcn-ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { IconCopy, IconChevronRight, IconChevronDown } from "@tabler/icons-react"
import { Check, Copy } from "lucide-react"
import MagicIcon from "@/components/base/MagicIcon"
import CommonPopup from "@/pages/superMagicMobile/components/CommonPopup"
import { VipSwitch, VipBadge } from "@/pages/superMagic/components/VipSwitch"
import { ResourceType, ShareType } from "../Share/types"
import {
	isTopicShareTypePermitted,
	resolveTopicPasswordEnabled,
	useTopicShareTypePermissions,
} from "../Share/hooks/useTopicShareTypePermissions"
import { generateSharePassword, generateTopicShareMessageText } from "../Share/utils"
import { analyticsService } from "@/services/analytics"
import { SharePasswordField } from "../Share/ShareFields"
import { useStyles } from "./styles"
import { cn } from "@/utils/cn"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { ShareListRefreshType } from "@/pages/superMagic/components/ShareManagement/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { isMagicApp, isNoHoverCoarsePointer } from "@/utils/devices"

interface TopicSharePopoverProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	topicId: string
	topicTitle?: string
	children?: React.ReactNode
	onSaveSuccess?: () => void // 保存成功回调
	/** Warning under "show file list" while it is off, for topics whose value lives in files. */
	fileListOffHint?: string
	/**
	 * Dialog mode only (no children): where focus goes when the dialog closes, for openers that
	 * are not the focused element when it opens (e.g. a menu item whose menu has just closed).
	 */
	onCloseAutoFocus?: (event: Event) => void
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

/**
 * Automatic clipboard writes run outside a user gesture when the popover loads.
 * Safari blocks that flow even on HTTPS, so keep auto-copy limited to browsers
 * where it is safe and leave the explicit copy buttons available everywhere.
 */
function canAutoCopy(): boolean {
	if (typeof window === "undefined" || typeof navigator === "undefined") return false

	const userAgent = navigator.userAgent
	const isSafari =
		/Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/i.test(userAgent)

	return (
		window.location.protocol === "https:" &&
		!isSafari &&
		document.visibilityState === "visible" &&
		document.hasFocus() &&
		Boolean(navigator.clipboard?.writeText)
	)
}

function TopicSharePopoverContent({
	topicId,
	topicTitle,
	onSaveSuccess,
	className,
	onDataChanged,
	fileListOffHint,
}: {
	topicId: string
	topicTitle?: string
	onSaveSuccess?: () => void
	className?: string
	onDataChanged?: () => void
	fileListOffHint?: string
}) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	// Topic shares inherit the share permission group (project or micro app) of the owning page.
	const topicSharePermissions = useTopicShareTypePermissions()
	const permittedTopicShareTypes = topicSharePermissions.permittedTypes
	// Granted methods are unknown until the request settles, so no share may be written meanwhile.
	const isPermissionPending = topicSharePermissions.isLoading

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
	// A draft share follows the granted methods once they arrive, so a group that only opened public
	// access never keeps the password default from the initial state.
	useEffect(() => {
		const grantedType = topicSharePermissions.defaultShareType
		if (
			settings.shareEnabled ||
			grantedType === undefined ||
			settings.shareType === grantedType
		) {
			return
		}

		setSettings((prev) =>
			prev.shareEnabled
				? prev
				: {
						...prev,
						shareType: grantedType,
						passwordEnabled: grantedType === ShareType.PasswordProtected,
						password:
							grantedType === ShareType.PasswordProtected
								? prev.password || generateSharePassword()
								: "",
					},
		)
	}, [settings.shareEnabled, settings.shareType, topicSharePermissions.defaultShareType])
	// An already saved share keeps its own method, so a closed method is reported instead of rewritten.
	const isCurrentShareTypePermitted = isTopicShareTypePermitted(
		settings.shareEnabled ? settings.shareType : undefined,
		permittedTopicShareTypes,
	)
	const passwordEnabled = isCurrentShareTypePermitted
		? resolveTopicPasswordEnabled(settings.passwordEnabled, topicSharePermissions)
		: settings.passwordEnabled
	const isPasswordSwitchLockedByPermission = topicSharePermissions.isPasswordSwitchLocked
	const isShareMethodUnavailable = topicSharePermissions.hasNoPermittedShareType
	const isPasswordSwitchDisabled =
		isPermissionPending ||
		isShareMethodUnavailable ||
		isPasswordSwitchLockedByPermission ||
		!isCurrentShareTypePermitted
	// Turning sharing on needs the granted methods, while turning an existing share off never does.
	const isShareEnableSwitchDisabled =
		isShareMethodUnavailable || (isPermissionPending && !settings.shareEnabled)
	// The administrator closed public access and password protection, so no share can be created or
	// managed here: the link, the password switch and the advanced options would all be dead ends.
	const isShareDetailHidden = isShareMethodUnavailable
	// Saves reuse the switch state, but never rewrite a legacy team share into another method.
	const effectiveSaveShareType =
		settings.shareType === ShareType.Organization
			? ShareType.Organization
			: passwordEnabled
				? ShareType.PasswordProtected
				: ShareType.Public
	const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
	const [isCopied, setIsCopied] = useState(false)
	const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	/** Resolves the share method a password switch position maps to. */
	const resolveShareType = useCallback(
		(usesPassword: boolean) => (usesPassword ? ShareType.PasswordProtected : ShareType.Public),
		[],
	)

	/** Guards every save path so a restricted method can never be written back. */
	const ensureShareTypeAllowed = useCallback(
		(shareType: ShareType) => {
			if (isShareMethodUnavailable) {
				magicToast.error(t("share.noAvailableShareMethods"))
				return false
			}
			if (!isTopicShareTypePermitted(shareType, permittedTopicShareTypes)) {
				magicToast.error(t("share.currentShareMethodUnavailable"))
				return false
			}
			return true
		},
		[isShareMethodUnavailable, permittedTopicShareTypes, t],
	)

	// Auto copy share message and show visual feedback when the environment allows it.
	const autoCopyShareMessage = useCallback(
		(shareUrl: string) => {
			if (!canAutoCopy()) {
				console.log("Auto-copy skipped: unsupported environment")
				return
			}

			const shareMessage = generateTopicShareMessageText({ topicTitle, shareUrl, t })
			void clipboard
				.writeText(shareMessage)
				.then(() => {
					if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
					setIsCopied(true)
					copyTimeoutRef.current = setTimeout(() => {
						setIsCopied(false)
						copyTimeoutRef.current = null
					}, 2000)
				})
				.catch((error) => {
					console.warn("Auto-copy unavailable:", error)
				})
		},
		[topicTitle, t],
	)

	// Load existing share settings
	useEffect(() => {
		async function loadShareSettings() {
			try {
				const data = await SuperMagicApi.getShareInfoByCode({ code: topicId })
				if (data?.resource_id) {
					const isShareEnabled = data.share_type !== ShareType.None
					const shareUrl = `${window.location.origin}/share/topic/${topicId}`
					const finalShareUrl = data.password
						? `${shareUrl}?password=${data.password}`
						: shareUrl

					setSettings({
						shareEnabled: isShareEnabled,
						shareUrl: finalShareUrl,
						passwordEnabled: !!data.password,
						password: data.password || "",
						showOriginalInfo: data.extra?.show_original_info ?? true,
						showFileList: data.extra?.view_file_list ?? true,
						shareType: data.share_type as ShareType,
					})

					// If share is already enabled, auto copy share message
					if (isShareEnabled) {
						autoCopyShareMessage(finalShareUrl)
					}
				}
			} catch (error) {
				// If no share settings exist, keep default state
				console.log("No existing share settings")
			}
		}

		if (topicId) {
			loadShareSettings()
		}
	}, [topicId, autoCopyShareMessage])

	// Handle share enable toggle
	const handleShareEnabledChange = useCallback(
		async (checked: boolean) => {
			// Turning sharing on needs the granted methods, which are unknown while the request runs.
			if (checked && isPermissionPending) return

			try {
				if (checked) {
					// Enable share - create share with the method allowed by the permission group
					const newShareType = resolveShareType(passwordEnabled)
					if (!ensureShareTypeAllowed(newShareType)) return

					const password = passwordEnabled
						? settings.password || generateSharePassword()
						: ""
					analyticsService.report("content_share_attempted", {
						resourceType: ResourceType.Topic,
					})
					await SuperMagicApi.createShareTopic({
						resource_id: topicId,
						resource_type: ResourceType.Topic,
						share_type: newShareType,
						password,
						extra: {
							show_original_info: settings.showOriginalInfo,
							view_file_list: settings.showFileList,
						},
					})
					const shareUrl = `${window.location.origin}/share/topic/${topicId}`
					const finalShareUrl = password ? `${shareUrl}?password=${password}` : shareUrl
					setSettings((prev) => ({
						...prev,
						shareEnabled: true,
						shareUrl: finalShareUrl,
						password,
						shareType: newShareType,
					}))

					// Auto copy share message to clipboard (silently, no toast)
					autoCopyShareMessage(finalShareUrl)

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
			isPermissionPending,
			passwordEnabled,
			resolveShareType,
			ensureShareTypeAllowed,
			settings.password,
			settings.showOriginalInfo,
			settings.showFileList,
			topicId,
			autoCopyShareMessage,
			onSaveSuccess,
			onDataChanged,
			t,
		],
	)

	// Handle password toggle
	const handlePasswordEnabledChange = useCallback(
		async (checked: boolean) => {
			// The administrator restricted the available methods, so the switch stays where it is.
			if (isPasswordSwitchDisabled) return

			const newShareType = resolveShareType(checked)

			if (!settings.shareEnabled) {
				setSettings((prev) => ({
					...prev,
					passwordEnabled: checked,
					password: checked ? generateSharePassword() : "",
				}))
				return
			}

			if (!ensureShareTypeAllowed(newShareType)) return

			try {
				const password = checked ? generateSharePassword() : ""
				await SuperMagicApi.createShareTopic({
					resource_id: topicId,
					resource_type: ResourceType.Topic,
					share_type: newShareType,
					password: password,
					extra: {
						show_original_info: settings.showOriginalInfo,
						view_file_list: settings.showFileList,
					},
				})

				const shareUrl = `${window.location.origin}/share/topic/${topicId}`
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
			isPasswordSwitchDisabled,
			resolveShareType,
			ensureShareTypeAllowed,
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
		return generateTopicShareMessageText({
			topicTitle,
			shareUrl: settings.shareUrl,
			t,
		})
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
									data-testid="topic-share-popover"
								>
									{urlMatch[0]}
								</a>
								<button
									type="button"
									className="ml-1 inline-flex translate-y-[2px] items-center justify-center rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									onClick={(e) => {
										e.stopPropagation()
										clipboard.writeText(urlMatch[0])
										magicToast.success(t("share.copySuccess"))
									}}
									title={t("share.copyLink")}
									data-testid="write-text"
								>
									<Copy className="h-3.5 w-3.5" />
								</button>
								{parts[1]}
							</div>
						)
					}
					return <div key={index}>{line}</div>
				})}
			</>
		)
	}, [shareMessageText, t])

	// Handle copy share message
	const handleCopyShareMessage = useCallback(() => {
		clipboard.writeText(shareMessageText)
		magicToast.success(t("share.copyShareMessageSuccess"))

		// Clear existing timeout
		if (copyTimeoutRef.current) {
			clearTimeout(copyTimeoutRef.current)
		}

		// Show check icon
		setIsCopied(true)

		// Reset to copy icon after 2 seconds
		copyTimeoutRef.current = setTimeout(() => {
			setIsCopied(false)
			copyTimeoutRef.current = null
		}, 2000)
	}, [shareMessageText, t])

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (copyTimeoutRef.current) {
				clearTimeout(copyTimeoutRef.current)
			}
		}
	}, [])

	// Handle copy password
	const handleCopyPassword = useCallback(() => {
		if (settings.password) {
			clipboard.writeText(settings.password)
			magicToast.success(t("share.copyPasswordSuccess"))
		}
	}, [settings.password, t])

	// Handle reset password
	const handleResetPassword = useCallback(async () => {
		if (!settings.shareEnabled || !passwordEnabled) return
		if (!ensureShareTypeAllowed(ShareType.PasswordProtected)) return

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
		passwordEnabled,
		ensureShareTypeAllowed,
		settings.shareEnabled,
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

			// Keep the saved method intact while the administrator has closed it.
			if (!isCurrentShareTypePermitted) {
				magicToast.error(t("share.currentShareMethodUnavailable"))
				return
			}

			try {
				await SuperMagicApi.createOrUpdateShareResource({
					resource_id: topicId,
					resource_type: ResourceType.Topic,
					share_type: effectiveSaveShareType,
					...(effectiveSaveShareType === ShareType.Organization
						? {}
						: {
								password: passwordEnabled
									? settings.password || undefined
									: undefined,
							}),
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
			isCurrentShareTypePermitted,
			effectiveSaveShareType,
			passwordEnabled,
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
					disabled={isShareEnableSwitchDisabled}
					onCheckedChange={handleShareEnabledChange}
					data-testid="topic-share-enable-switch"
				/>
				<div className={styles.switchLabel}>
					<div className={styles.switchTitle}>{t("share.enableShare")}</div>
					<div className={styles.switchDescription}>
						{t("share.enableShareDescription")}
					</div>
				</div>
			</div>

			{isShareMethodUnavailable && (
				<p
					className="text-sm text-destructive"
					role="alert"
					data-testid="topic-share-no-method-hint"
				>
					{t("share.noAvailableShareMethods")}
				</p>
			)}

			{settings.shareEnabled && !isShareDetailHidden && (
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
							{isCopied ? (
								<Check size={16} color="#22c55e" strokeWidth={2} />
							) : (
								<MagicIcon component={IconCopy} size={16} color="#fff" stroke={2} />
							)}
							{isCopied
								? t("share.copyShareMessageSuccess")
								: t("share.copyShareMessage")}
						</Button>
					</div>

					{/* Password Switch */}
					<div className={styles.switchRow}>
						<Switch
							checked={passwordEnabled}
							disabled={isPasswordSwitchDisabled}
							onCheckedChange={handlePasswordEnabledChange}
							data-testid="topic-share-password-switch"
						/>
						<div className={styles.switchLabel}>
							<div className={styles.switchTitle}>{t("share.accessPassword")}</div>
						</div>
					</div>

					{!isCurrentShareTypePermitted ? (
						<p
							className="text-sm text-destructive"
							role="alert"
							data-testid="topic-share-permission-hint"
						>
							{t("share.currentShareMethodUnavailable")}
						</p>
					) : isPasswordSwitchLockedByPermission ? (
						<p
							className="text-sm text-muted-foreground"
							data-testid="topic-share-permission-locked-hint"
						>
							{t("share.shareMethodRestrictedByAdmin")}
						</p>
					) : null}

					{/* Password Input (shown when enabled) */}
					{passwordEnabled && (
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
							data-testid="set-is-advanced-open"
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
										{fileListOffHint && !settings.showFileList ? (
											<div className="text-xs text-amber-600 dark:text-amber-400">
												{fileListOffHint}
											</div>
										) : null}
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
	fileListOffHint,
	onCloseAutoFocus,
}: TopicSharePopoverProps) {
	const isMobile = useIsMobile()
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
						fileListOffHint={fileListOffHint}
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
				<DialogContent
					className="w-[420px] p-3.5"
					style={{ zIndex: 1500 }}
					onCloseAutoFocus={onCloseAutoFocus}
				>
					{topicTitle && (
						<DialogHeader>
							<DialogTitle>{topicTitle}</DialogTitle>
						</DialogHeader>
					)}
					<TopicSharePopoverContent
						fileListOffHint={fileListOffHint}
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
						fileListOffHint={fileListOffHint}
						// Same inner padding as the desktop popover and the trigger-less sheet; without it
						// the switches, link box and buttons ran into the sheet's edges.
						className="p-3.5"
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
				onFocusOutside={(e) => {
					// Embedded SDK iframes can move focus to the host document during a tap,
					// which is not an intentional dismissal of the desktop popover.
					if (isMagicApp || isNoHoverCoarsePointer() || window.parent !== window) {
						e.preventDefault()
					}
				}}
			>
				<TopicSharePopoverContent
					fileListOffHint={fileListOffHint}
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
