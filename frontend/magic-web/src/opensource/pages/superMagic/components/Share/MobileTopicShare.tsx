import { memo, useCallback, useMemo, useState } from "react"
import { clipboard } from "@/opensource/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { Switch } from "@/opensource/components/shadcn-ui/switch"
import { Label } from "@/opensource/components/shadcn-ui/label"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Copy } from "lucide-react"
import type { ShareExtraData } from "./types"
import { ShareType, ResourceType, ShareMode } from "./types"
import { SuperMagicApi } from "@/opensource/apis"
import { generateSharePassword } from "./utils"
import {
	ShareAdvancedSettings,
	SharePasswordField,
	type ShareAdvancedSettingsData,
} from "./ShareFields"
import { useUpdateEffect } from "ahooks"
import magicToast from "@/opensource/components/base/MagicToaster/utils"
import { generateShareUrl } from "@/opensource/pages/superMagic/components/ShareManagement/utils/shareTypeHelpers"

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
	onSaveSuccess?: () => void
	onClose?: () => void
}

export default memo(function MobileTopicShare(props: MobileTopicShareProps) {
	const { shareContext, extraData, setExtraData, type, onSaveSuccess, onClose } = props

	const { t } = useTranslation("super")

	// 分享开关状态
	const [shareEnabled, setShareEnabled] = useState(() => {
		return type === ShareType.Public || type === ShareType.PasswordProtected
	})

	useUpdateEffect(() => {
		setShareEnabled(type === ShareType.Public || type === ShareType.PasswordProtected)
	}, [type])

	// 分享链接
	const shareUrl = useMemo(() => {
		// 优先从 extraData 获取
		if (extraData?.shareUrl) {
			return extraData.shareUrl
		}
		// 其次从 shareContext 获取
		if (shareContext?.share_url) {
			return shareContext.share_url
		}
		// 最后使用 generateShareUrl 构建
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

	// 获取 resourceId
	const resourceId = shareContext?.resource_id

	// 密码开关状态 - 默认开启密码保护
	const passwordEnabled = extraData?.passwordEnabled ?? true

	// 处理分享开关变化
	const handleShareToggle = useCallback(
		async (checked: boolean) => {
			setShareEnabled(checked)

			if (checked) {
				// 开启分享 - 根据密码开关状态确定 share_type
				// 如果 extraData 为空，初始化默认值（密码保护开启）
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
						password: password,
					})
				}

				// 如果有 resourceId，调用 API 创建分享
				if (resourceId) {
					try {
						await SuperMagicApi.createOrUpdateShareResource({
							resource_id: resourceId,
							resource_type: ResourceType.Topic,
							share_type: newShareType,
							password: password,
							topic_id: resourceId,
							extra: {
								allow_copy_project_files: extraData?.allowCopy ?? true,
								show_original_info: extraData?.showOriginalInfo ?? true,
								view_file_list: extraData?.view_file_list ?? true,
								hide_created_by_super_magic: extraData?.hideCreatorInfo ?? false,
							},
						})
						onSaveSuccess?.()
					} catch (error) {
						console.error("Failed to enable share:", error)
						magicToast.error(t("share.createFailed"))
						setShareEnabled(false)
					}
				}
			} else {
				// 关闭分享 - 取消分享
				if (resourceId) {
					try {
						await SuperMagicApi.cancelShareResource({ resourceId })
						magicToast.success(t("shareManagement.cancelShareSuccess"))
						onSaveSuccess?.()
						onClose?.()
					} catch (error) {
						console.error("Failed to cancel share:", error)
						magicToast.error(t("shareManagement.cancelShareFailed"))
						setShareEnabled(true)
					}
				}
			}
		},
		[extraData, setExtraData, resourceId, onSaveSuccess, t, onClose],
	)

	// 处理密码开关变化
	const handlePasswordToggle = useCallback(
		async (checked: boolean) => {
			// 根据密码开关状态确定新的 share_type
			const newShareType = checked ? ShareType.PasswordProtected : ShareType.Public

			if (setExtraData) {
				const newExtraData = {
					...(extraData || {}),
					passwordEnabled: checked,
					password: checked
						? extraData?.password || generateSharePassword()
						: extraData?.password,
				}
				setExtraData(newExtraData)

				// 保存到服务器
				if (resourceId) {
					try {
						await SuperMagicApi.createOrUpdateShareResource({
							resource_id: resourceId,
							resource_type: ResourceType.Topic,
							share_type: newShareType,
							password: checked
								? newExtraData.password || generateSharePassword()
								: undefined,
							topic_id: resourceId,
							extra: {
								allow_copy_project_files: newExtraData.allowCopy ?? true,
								show_original_info: newExtraData.showOriginalInfo ?? true,
								view_file_list: newExtraData.view_file_list ?? true,
								hide_created_by_super_magic: newExtraData.hideCreatorInfo ?? false,
							},
						})
						onSaveSuccess?.()
					} catch (error) {
						console.error("Failed to update password setting:", error)
						magicToast.error(t("share.createFailed"))
					}
				}
			}
		},
		[extraData, setExtraData, resourceId, onSaveSuccess, t],
	)

	// 复制分享链接
	const handleCopyShareUrl = useCallback(() => {
		if (shareUrl) {
			clipboard.writeText(shareUrl)
			magicToast.success(t("share.copyLinkSuccess"))
		}
	}, [shareUrl, t])

	// 复制密码
	const handleCopyPassword = useCallback(() => {
		if (extraData?.password) {
			clipboard.writeText(extraData.password)
			magicToast.success(t("share.copyPasswordSuccess"))
		}
	}, [extraData?.password, t])

	// 重置密码
	const handleResetPassword = useCallback(async () => {
		if (setExtraData && resourceId) {
			try {
				const newPassword = generateSharePassword()
				const newExtraData = {
					...(extraData || {}),
					password: newPassword,
				}
				setExtraData(newExtraData)

				// 保存到服务器
				await SuperMagicApi.createOrUpdateShareResource({
					resource_id: resourceId,
					resource_type: ResourceType.Topic,
					share_type: type,
					password: newPassword,
					topic_id: resourceId,
					extra: {
						allow_copy_project_files: newExtraData.allowCopy ?? true,
						show_original_info: newExtraData.showOriginalInfo ?? true,
						view_file_list: newExtraData.view_file_list ?? true,
						hide_created_by_super_magic: newExtraData.hideCreatorInfo ?? false,
					},
				})
				magicToast.success(t("share.resetPasswordSuccess"))
				onSaveSuccess?.()
			} catch (error) {
				console.error("Failed to reset password:", error)
				magicToast.error(t("share.resetPasswordFailed"))
			}
		}
	}, [extraData, setExtraData, resourceId, type, onSaveSuccess, t])

	// 高级设置变化
	const handleAdvancedSettingsChange = useCallback(
		async (settings: ShareAdvancedSettingsData) => {
			if (setExtraData) {
				const newExtraData = {
					...(extraData || {}),
					showOriginalInfo: settings.showOriginalInfo,
					view_file_list: settings.view_file_list,
					hideCreatorInfo: settings.hideCreatorInfo,
				}
				setExtraData(newExtraData)

				// 保存到服务器
				if (resourceId) {
					try {
						// 根据当前密码状态确定 share_type
						const currentShareType = extraData?.passwordEnabled
							? ShareType.PasswordProtected
							: ShareType.Public

						await SuperMagicApi.createOrUpdateShareResource({
							resource_id: resourceId,
							resource_type: ResourceType.Topic,
							share_type: currentShareType,
							password: extraData?.passwordEnabled ? extraData.password : undefined,
							topic_id: resourceId,
							extra: {
								allow_copy_project_files: newExtraData.allowCopy ?? true,
								show_original_info: newExtraData.showOriginalInfo ?? true,
								view_file_list: newExtraData.view_file_list ?? true,
								hide_created_by_super_magic: newExtraData.hideCreatorInfo ?? false,
							},
						})
						onSaveSuccess?.()
					} catch (error) {
						console.error("Failed to update advanced settings:", error)
						magicToast.error(t("share.createFailed"))
					}
				}
			}
		},
		[extraData, setExtraData, resourceId, onSaveSuccess, t],
	)

	// 准备给 ShareAdvancedSettings 的设置数据
	const advancedSettings = useMemo<ShareAdvancedSettingsData>(
		() => ({
			showOriginalInfo: extraData?.showOriginalInfo,
			view_file_list: extraData?.view_file_list,
			hideCreatorInfo: extraData?.hideCreatorInfo,
		}),
		[extraData?.showOriginalInfo, extraData?.view_file_list, extraData?.hideCreatorInfo],
	)

	return (
		<div className="flex flex-col gap-3 p-3">
			{/* 开启分享开关 */}
			<div className="flex items-start gap-3">
				<Switch
					checked={shareEnabled}
					onCheckedChange={handleShareToggle}
					className="mt-0.5"
				/>
				<div className="flex flex-1 flex-col gap-2">
					<Label className="text-sm font-medium leading-none text-foreground">
						{t("share.enableShare")}
					</Label>
					<p className="text-sm leading-normal text-muted-foreground">
						{t("share.enableShareDescription")}
					</p>
				</div>
			</div>

			{/* 开启分享后显示的内容 */}
			{shareEnabled && (
				<>
					<Separator />

					{/* 分享链接 */}
					<div className="flex flex-col gap-2">
						<Label className="text-sm font-medium leading-none text-foreground">
							{t("share.shareLink")}
						</Label>
						<div className="flex items-center gap-[-1px]">
							<Input
								value={shareUrl}
								readOnly
								className="flex-1 cursor-pointer rounded-r-none border-r-0"
								onClick={() => {
									if (shareUrl) {
										window.open(shareUrl, "_blank", "noopener,noreferrer")
									}
								}}
							/>
							<Button
								variant="outline"
								size="icon"
								className="rounded-l-none"
								onClick={handleCopyShareUrl}
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>
					</div>

					{/* 访问密码开关 */}
					<div className="flex items-center gap-3">
						<Switch checked={passwordEnabled} onCheckedChange={handlePasswordToggle} />
						<Label className="text-sm font-medium leading-none text-foreground">
							{t("share.accessPassword")}
						</Label>
					</div>

					{/* 密码输入框 - 开启密码后显示 */}
					{passwordEnabled && (
						<SharePasswordField
							password={extraData?.password || ""}
							onCopy={handleCopyPassword}
							onReset={handleResetPassword}
							showLabel={false}
						/>
					)}

					{/* 高级选项 */}
					<ShareAdvancedSettings
						settings={advancedSettings}
						onChange={handleAdvancedSettingsChange}
						mode={ShareMode.Topic}
					/>
				</>
			)}
		</div>
	)
})
