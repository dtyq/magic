import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { clipboard } from "@/utils/clipboard-helpers"
import { useTranslation } from "react-i18next"
import { IconShare3 } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import MagicModal from "@/components/base/MagicModal"
import type { ShareProps, ShareExtraData } from "./types"
import { ShareMode, ResourceType, ShareType } from "./types"
import { SuperMagicApi } from "@/apis"
import useStyles from "./style"
import { useUpdateEffect } from "ahooks"
import { generateSharePassword } from "./utils"
import {
	ShareTypeField,
	SharePasswordField,
	ShareExpiryField,
	ShareAdvancedSettings,
	type ShareAdvancedSettingsData,
} from "./ShareFields"
import magicToast from "@/components/base/MagicToaster/utils"

// 生成随机密码
export const generateRandomPassword = (length: number) => {
	const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	let result = ""
	for (let i = 0; i < length; i += 1) {
		result += characters.charAt(Math.floor(Math.random() * characters.length))
	}
	return result
}

export default memo(function Share(props: ShareProps) {
	const {
		onChangeType,
		types,
		extraData,
		setExtraData,
		type,
		getValidateShareSettings,
		shareMode = ShareMode.Topic, // Default to topic sharing
		topicTitle,
		shareContext,
		handleOk,
	} = props

	const { t } = useTranslation("super")
	const { styles } = useStyles()

	// Local state for share expiry
	const [shareExpiry, setShareExpiry] = useState<number | null>(null)

	// Get resourceId from shareContext (topicId = resourceId for topic sharing)
	const resourceId = shareContext?.resource_id

	// Check if password field should be visible
	const showPasswordField = type === ShareType.PasswordProtected

	// Ref to track previous values for auto-save
	const previousValues = useRef<{
		type: number
		extraData: ShareExtraData
		shareExpiry: number | null
	}>({
		type: type,
		extraData: extraData || {},
		shareExpiry: shareExpiry,
	})

	// Auto-save share settings when values change
	useUpdateEffect(() => {
		if (!resourceId || !shareContext) return

		const hasChanged =
			previousValues.current.type !== type ||
			previousValues.current.shareExpiry !== shareExpiry ||
			JSON.stringify(previousValues.current.extraData) !== JSON.stringify(extraData)

		if (!hasChanged) return

		previousValues.current = {
			type,
			extraData: extraData || {},
			shareExpiry,
		}

		const saveShareSettings = async () => {
			try {
				await SuperMagicApi.createOrUpdateShareResource({
					resource_id: resourceId,
					resource_type: ResourceType.Topic, // 5 = Topic
					share_type: type,
					expire_days: shareExpiry === null ? undefined : shareExpiry,
					password: extraData?.passwordEnabled ? extraData.password : undefined,
					topic_id: resourceId, // topicId = resourceId for topic sharing
					extra: {
						allow_copy_project_files: extraData?.allowCopy ?? true,
						show_original_info: extraData?.showOriginalInfo ?? true,
						view_file_list: extraData?.view_file_list ?? true,
						hide_created_by_super_magic: extraData?.hideCreatorInfo ?? false,
						allow_download_project_file: extraData?.allowDownloadProjectFile ?? true,
					},
					project_id: extraData?.project_id ?? "",
				})

				// Call handleOk if provided
				if (handleOk) {
					handleOk(type, extraData || {})
				}
			} catch (error) {
				console.error("Failed to save share settings:", error)
				magicToast.error(t("share.createFailed"))
			}
		}

		// Debounce API calls (wait 500ms after last change)
		const timeoutId = setTimeout(() => {
			saveShareSettings()
		}, 500)

		return () => {
			clearTimeout(timeoutId)
		}
	}, [type, extraData, shareExpiry])

	// Handle share type change
	const handleShareTypeChange = useCallback(
		(newType: ShareType) => {
			// Normalize to Internet type for PasswordProtected and Public
			if (newType === ShareType.PasswordProtected || newType === ShareType.Public) {
				if (onChangeType) {
					onChangeType(newType)
				}
				// Update passwordEnabled based on type
				if (setExtraData) {
					setExtraData({
						...(extraData || {}),
						passwordEnabled: newType === ShareType.PasswordProtected,
						password:
							newType === ShareType.PasswordProtected
								? extraData?.password || generateSharePassword()
								: extraData?.password,
					})
				}
			} else {
				if (onChangeType) {
					onChangeType(newType)
				}
			}
		},
		[onChangeType, setExtraData, extraData],
	)

	// Handle password copy
	const handlePasswordCopy = useCallback(() => {
		if (extraData?.password) {
			clipboard.writeText(extraData.password)
			magicToast.success(t("share.copyPasswordSuccess"))
		}
	}, [extraData?.password, t])

	// Handle password reset
	const handlePasswordReset = useCallback(() => {
		MagicModal.confirm({
			title: t("common.tip"),
			content: t("share.resetPasswordConfirm"),
			centered: true,
			onOk: () => {
				const newPassword = generateSharePassword()
				if (setExtraData) {
					setExtraData({
						...(extraData || {}),
						password: newPassword,
					})
				}
				magicToast.success(t("share.resetPasswordSuccess"))
			},
			okText: t("share.confirmReset"),
			cancelText: t("common.cancel"),
			okButtonProps: {
				danger: true,
			},
			zIndex: 1500, // 确保在 ShareModal (1400) 之上
		})
	}, [extraData, setExtraData, t])

	// Handle advanced settings change
	const handleAdvancedSettingsChange = useCallback(
		(settings: ShareAdvancedSettingsData) => {
			if (setExtraData) {
				setExtraData({
					...(extraData || {}),
					...settings,
				})
			}
		},
		[extraData, setExtraData],
	)

	// Validate share settings
	const validateShareSettings = useCallback(() => {
		return true
	}, [])

	// Pass validation function to parent
	useEffect(() => {
		if (getValidateShareSettings) {
			getValidateShareSettings(validateShareSettings)
		}
	}, [getValidateShareSettings, validateShareSettings])

	return (
		<div className={styles.shareContainer}>
			{/* Topic info display - only for topic sharing */}
			{shareMode === ShareMode.Topic && (
				<div className={styles.topicInfo}>
					<div className={styles.topicInfoLeft}>
						<MagicIcon component={IconShare3} size={20} className={styles.topicIcon} />
						<span className={styles.topicLabel}>{t("share.topic")}</span>
					</div>
					<div className={styles.topicInfoRight}>
						<span className={styles.topicTitleHash}># </span>
						<span className={styles.topicTitle}>
							{topicTitle || t("messageHeader.untitledTopic")}
						</span>
						<span className={styles.topicTitleHash}> #</span>
					</div>
				</div>
			)}

			{/* Share configuration fields */}
			<div className="flex flex-col gap-3">
				{/* Share Type */}
				<ShareTypeField
					value={type}
					onChange={handleShareTypeChange}
					availableTypes={types}
				/>

				{/* Password Field - only show if password protected */}
				{showPasswordField && (
					<SharePasswordField
						password={extraData?.password || ""}
						onCopy={handlePasswordCopy}
						onReset={handlePasswordReset}
					/>
				)}

				{/* Expiry Field */}
				<ShareExpiryField value={shareExpiry} onChange={setShareExpiry} />

				{/* Advanced Settings */}
				<ShareAdvancedSettings
					settings={{
						showOriginalInfo: extraData?.showOriginalInfo,
						view_file_list: extraData?.view_file_list,
						allowDownloadProjectFile: extraData?.allowDownloadProjectFile,
					}}
					onChange={handleAdvancedSettingsChange}
					mode={shareMode}
				/>
			</div>
		</div>
	)
})
