import { memo, useCallback, useMemo, useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { clipboard } from "@/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { Switch } from "@/components/shadcn-ui/switch"
import type { ShareExtraData } from "./types"
import { ShareType, ResourceType } from "./types"
import { SuperMagicApi } from "@/apis"
import { generateSharePassword, generateTopicShareMessageText } from "./utils"
import { useUpdateEffect } from "ahooks"
import magicToast from "@/components/base/MagicToaster/utils"
import { generateShareUrl } from "@/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"

interface MobileTopicShareProps {
	shareContext?: {
		resource_id?: string
		share_url?: string
		share_type?: number
		extra?: {
			show_original_info?: boolean
			view_file_list?: boolean
			hide_created_by_super_magic?: boolean
		}
	}
	extraData?: ShareExtraData
	setExtraData?: (data: ShareExtraData) => void
	type: number
	topicTitle?: string
	onSaveSuccess?: () => void
	onClose?: () => void
}

/**
 * 统一渲染分组标题，保持移动端分享卡片的层级和留白一致。
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
	return <div className="px-0.5 text-sm leading-5 text-muted-foreground">{children}</div>
}

/**
 * 提供白色圆角卡片容器，避免每个区块重复声明相同的外观样式。
 */
function CardGroup({ children, testId }: { children: React.ReactNode; testId?: string }) {
	return (
		<div className="overflow-hidden rounded-2xl bg-white" data-testid={testId}>
			{children}
		</div>
	)
}

/**
 * 将移动端开关项扩展成整行可点击区域，减少用户必须精确点击开关按钮的成本。
 */
function TopicSettingsRow({
	label,
	checked,
	onCheckedChange,
	testId,
}: {
	label: string
	checked: boolean
	onCheckedChange: (value: boolean) => void
	testId: string
}) {
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => onCheckedChange(!checked)}
			// 保持整行可点击，减少移动端误触开关本体的成本。
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault()
					onCheckedChange(!checked)
				}
			}}
			className="flex h-12 w-full items-center gap-3 px-3.5 active:opacity-70"
			data-testid={testId}
		>
			<div className="flex-1 text-left text-base leading-5 text-foreground">{label}</div>
			<Switch checked={checked} className="pointer-events-none shrink-0" />
		</div>
	)
}

export default memo(function MobileTopicShare(props: MobileTopicShareProps) {
	const { shareContext, extraData, setExtraData, type, topicTitle, onSaveSuccess } = props

	const { t } = useTranslation("super")
	const [isPasswordVisible, setIsPasswordVisible] = useState(false)

	// 分享开关状态
	const [shareEnabled, setShareEnabled] = useState(() => {
		return type === ShareType.Public || type === ShareType.PasswordProtected
	})

	useUpdateEffect(() => {
		setShareEnabled(type === ShareType.Public || type === ShareType.PasswordProtected)
	}, [type])

	// 分享链接
	const shareUrl = useMemo(() => {
		if (extraData?.shareUrl) {
			return extraData.shareUrl
		}
		if (shareContext?.share_url) {
			return shareContext.share_url
		}
		if (shareContext?.resource_id) {
			const password = extraData?.passwordEnabled ? extraData?.password : undefined
			return generateShareUrl(shareContext.resource_id, password, "topic")
		}
		return ""
	}, [
		shareContext?.share_url,
		shareContext?.resource_id,
		extraData?.shareUrl,
		extraData?.password,
		extraData?.passwordEnabled,
	])

	const resourceId = shareContext?.resource_id
	const passwordEnabled = extraData?.passwordEnabled ?? true

	const sanitizedShareUrl = useMemo(() => {
		if (!shareUrl) {
			return ""
		}

		try {
			const url = new URL(shareUrl)
			url.searchParams.delete("password")
			return url.toString()
		} catch {
			return shareUrl
				.replace(/([?&])password=[^&]+&?/i, (_match, prefix) =>
					prefix === "?" ? "" : prefix,
				)
				.replace(/[?&]$/, "")
		}
	}, [shareUrl])

	// Clipboard uses the full access URL (with password query when enabled), same as PC TopicSharePopover.
	const shareUrlForClipboard = shareUrl || sanitizedShareUrl

	const shareMessageText = useMemo(() => {
		if (!shareUrlForClipboard) {
			return ""
		}

		return generateTopicShareMessageText({
			topicTitle,
			shareUrl: shareUrlForClipboard,
			t,
		})
	}, [shareUrlForClipboard, topicTitle, t])

	/**
	 * 统一把本地 extraData 映射为后端 extra 字段，避免多个保存入口出现字段不一致。
	 */
	const buildShareExtraPayload = useCallback((data?: ShareExtraData) => {
		return {
			allow_copy_project_files: data?.allowCopy ?? true,
			show_original_info: data?.showOriginalInfo ?? true,
			view_file_list: data?.view_file_list ?? true,
			hide_created_by_super_magic: data?.hideCreatorInfo ?? false,
		}
	}, [])

	/**
	 * 主开关保留即时保存语义，避免交互变更影响现有保存时机。
	 */
	const handleShareToggle = useCallback(
		async (checked: boolean) => {
			setShareEnabled(checked)

			if (checked) {
				const isPasswordProtected = extraData?.passwordEnabled ?? true
				const newShareType = isPasswordProtected
					? ShareType.PasswordProtected
					: ShareType.Public
				const password = isPasswordProtected
					? extraData?.password || generateSharePassword()
					: undefined

				if (setExtraData) {
					setExtraData({
						...(extraData || {}),
						passwordEnabled: isPasswordProtected,
						password,
					})
				}

				if (resourceId) {
					try {
						await SuperMagicApi.createOrUpdateShareResource({
							resource_id: resourceId,
							resource_type: ResourceType.Topic,
							share_type: newShareType,
							password,
							topic_id: resourceId,
							extra: buildShareExtraPayload({
								...(extraData || {}),
								passwordEnabled: isPasswordProtected,
								password,
							}),
						})
						onSaveSuccess?.()
					} catch (error) {
						console.error("Failed to enable share:", error)
						magicToast.error(t("share.createFailed"))
						setShareEnabled(false)
					}
				}
				return
			}

			if (resourceId) {
				try {
					await SuperMagicApi.cancelShareResource({ resourceId })
					magicToast.success(t("shareManagement.cancelShareSuccess"))
					onSaveSuccess?.()
				} catch (error) {
					console.error("Failed to cancel share:", error)
					magicToast.error(t("shareManagement.cancelShareFailed"))
					setShareEnabled(true)
				}
			}
		},
		[buildShareExtraPayload, extraData, onSaveSuccess, resourceId, setExtraData, t],
	)

	/**
	 * 密码保护切换只调整分享类型与密码字段，不改动其它高级设置的保存契约。
	 */
	const handlePasswordToggle = useCallback(
		async (checked: boolean) => {
			const newShareType = checked ? ShareType.PasswordProtected : ShareType.Public
			const nextExtraData = {
				...(extraData || {}),
				passwordEnabled: checked,
				password: checked
					? extraData?.password || generateSharePassword()
					: extraData?.password,
			}

			setExtraData?.(nextExtraData)

			if (resourceId) {
				try {
					await SuperMagicApi.createOrUpdateShareResource({
						resource_id: resourceId,
						resource_type: ResourceType.Topic,
						share_type: newShareType,
						password: checked ? nextExtraData.password : undefined,
						topic_id: resourceId,
						extra: buildShareExtraPayload(nextExtraData),
					})
					onSaveSuccess?.()
				} catch (error) {
					console.error("Failed to update password setting:", error)
					magicToast.error(t("share.createFailed"))
				}
			}
		},
		[buildShareExtraPayload, extraData, onSaveSuccess, resourceId, setExtraData, t],
	)

	const handleCopyShareUrl = useCallback(() => {
		if (!shareMessageText) return

		clipboard.writeText(shareMessageText)
		magicToast.success(t("share.copyShareMessageSuccess"))
	}, [shareMessageText, t])

	const passwordText = isPasswordVisible ? extraData?.password || "" : "• • • • • •"

	return (
		<div className="flex flex-col gap-2.5 bg-muted/30 px-3.5 pb-[max(var(--safe-area-inset-bottom),24px)] pt-2.5">
			<CardGroup testId="mobile-topic-share-toggle-card">
				<div
					role="button"
					tabIndex={0}
					onClick={() => void handleShareToggle(!shareEnabled)}
					// 通过整行点击承载主开关，减少触控时对开关热区的依赖。
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault()
							void handleShareToggle(!shareEnabled)
						}
					}}
					className="flex h-12 items-center gap-3 px-3.5 active:opacity-70"
					data-testid="mobile-topic-share-toggle-row"
				>
					<div className="flex-1 text-base leading-5 text-foreground">
						{t("share.enableShareLink")}
					</div>
					<Switch checked={shareEnabled} className="pointer-events-none shrink-0" />
				</div>
			</CardGroup>

			{shareEnabled ? (
				<div className="space-y-2.5">
					<div className="space-y-2">
						<SectionLabel>{t("share.conversationLink")}</SectionLabel>
						<CardGroup testId="mobile-topic-share-link-card">
							<div className="flex min-h-12 items-center px-3.5 py-3.5">
								<div
									className="min-w-0 break-all text-base leading-6 text-foreground"
									data-testid="mobile-topic-share-link-value"
								>
									{sanitizedShareUrl}
								</div>
							</div>
						</CardGroup>
					</div>

					<div className="space-y-2">
						<CardGroup>
							<TopicSettingsRow
								label={t("share.passwordProtection")}
								checked={passwordEnabled}
								onCheckedChange={(value) => void handlePasswordToggle(value)}
								testId="mobile-topic-share-password-toggle-row"
							/>
							{passwordEnabled ? (
								<>
									{/* 将密码展示保留在同一容器内，避免切换时出现断层。 */}
									<div className="h-px w-full bg-border" />
									<div
										className="flex h-12 items-center gap-2 px-3.5"
										data-testid="mobile-topic-share-password-card"
									>
										<div className="min-w-0 flex-1 font-mono text-base leading-5 text-muted-foreground">
											{passwordText}
										</div>
										<button
											type="button"
											className="shrink-0 p-1 text-muted-foreground active:opacity-60"
											onClick={() => setIsPasswordVisible((value) => !value)}
											aria-label={
												isPasswordVisible
													? t("share.hidePassword")
													: t("share.showPassword")
											}
											data-testid="mobile-topic-share-password-visibility-button"
										>
											{isPasswordVisible ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</>
							) : null}
						</CardGroup>
					</div>

					<button
						type="button"
						onClick={handleCopyShareUrl}
						className="flex h-12 w-full items-center justify-center rounded-lg bg-foreground px-3.5 text-base font-medium text-background active:opacity-70"
						data-testid="mobile-topic-share-copy-link-button"
					>
						{t("share.copyLinkAction")}
					</button>
				</div>
			) : null}
		</div>
	)
})
