import { memo, useEffect, useMemo, useState } from "react"
import { useBoolean, useMemoizedFn, useUpdateEffect } from "ahooks"
import { observer } from "mobx-react-lite"
import { Flex, Input, Spin } from "antd"
import { IconUpload } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { MagicUserApi } from "@/apis"
import MagicAvatar from "@/components/base/MagicAvatar"
import MagicButton from "@/components/base/MagicButton"
import MagicModal from "@/components/base/MagicModal"
import UploadAction from "@/components/base/UploadAction"
import { useUserInfo } from "@/models/user/hooks"
import { useAvatarUpload } from "@/components/settings/UserAvatar/hooks/useAvatarUpload"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import SettingStore from "@/stores/setting"
import magicToast from "@/components/base/MagicToaster/utils"
import { useStyles } from "./styles"

interface EditProfileModalProps {
	open?: boolean
	onClose?: () => void
}

function EditProfileModal({ open: openProp, onClose }: EditProfileModalProps) {
	const { t } = useTranslation("accountSetting")
	const { t: tInterface } = useTranslation("interface")
	const { styles } = useStyles()
	const { userInfo } = useUserInfo()
	const [open, { setTrue, setFalse }] = useBoolean(openProp ?? false)
	const [nickname, setNickname] = useState(userInfo?.nickname ?? "")
	const [avatarUrl, setAvatarUrl] = useState(userInfo?.avatar ?? "")
	const [isSaving, setIsSaving] = useState(false)
	const [hasChanges, setHasChanges] = useState(false)
	const { canUpdateAvatar, canUpdateNickname } = SettingStore
	const { uploadAvatar, isUploading } = useAvatarUpload()

	useEffect(() => {
		if (!open || !userInfo) return
		setNickname(userInfo.nickname ?? "")
		setAvatarUrl(userInfo.avatar ?? "")
		setHasChanges(false)
	}, [open, userInfo])

	useEffect(() => {
		if (openProp === undefined) return
		if (openProp) setTrue()
		else setFalse()
	}, [openProp, setFalse, setTrue])

	useUpdateEffect(() => {
		setHasChanges(nickname !== (userInfo?.nickname ?? ""))
	}, [nickname, userInfo])

	useEffect(() => {
		if (!userInfo?.avatar || !open) return
		setAvatarUrl(userInfo.avatar)
	}, [open, userInfo?.avatar])

	const handleFileChange = useMemoizedFn(async (files: FileList | File[]) => {
		await uploadAvatar(files)
	})

	const handleSave = useMemoizedFn(async () => {
		if (!hasChanges) {
			setFalse()
			onClose?.()
			return
		}

		setIsSaving(true)
		try {
			if (nickname !== (userInfo?.nickname ?? "")) {
				await MagicUserApi.updateUserInfo({ nickname })
				await service.get<UserService>("userService").refreshUserInfo()
				magicToast.success(tInterface("setting.updateNickname.success"))
			}
			setFalse()
			onClose?.()
		} catch (error) {
			console.error("Failed to update user profile:", error)
			magicToast.error(tInterface("setting.updateNickname.failed"))
		} finally {
			setIsSaving(false)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		setFalse()
		onClose?.()
	})

	const uploadHandler = useMemoizedFn((onUpload: () => void) => {
		return (
			<button
				type="button"
				className={styles.uploadButton}
				onClick={onUpload}
				disabled={isUploading}
				data-testid="account-setting-upload-avatar-button"
			>
				<IconUpload size={20} />
				<span>{tInterface("setting.uploadAvatar.title")}</span>
			</button>
		)
	})

	const footer = useMemo(
		() => (
			<Flex justify="flex-end" gap={10} style={{ width: "100%" }}>
				<MagicButton
					onClick={handleCancel}
					disabled={isSaving}
					data-testid="account-setting-edit-profile-cancel-button"
				>
					{t("cancel") || tInterface("button.cancel")}
				</MagicButton>
				<MagicButton
					type="primary"
					onClick={handleSave}
					loading={isSaving}
					disabled={!hasChanges}
					data-testid="account-setting-edit-profile-save-button"
				>
					{t("save") || tInterface("button.save") || tInterface("common.confirm")}
				</MagicButton>
			</Flex>
		),
		[handleCancel, handleSave, hasChanges, isSaving, t, tInterface],
	)

	return (
		<MagicModal
			width={400}
			title={t("editProfile")}
			open={open}
			onCancel={handleCancel}
			centered
			footer={footer}
			maskClosable={!isSaving}
			data-testid="account-setting-edit-profile-modal"
		>
			<div className={styles.modalContent}>
				{canUpdateAvatar ? (
					<div className={styles.avatarSection}>
						<div className={styles.avatarWrapper}>
							<MagicAvatar src={avatarUrl} size={64}>
								{userInfo?.nickname}
							</MagicAvatar>
							{isUploading ? (
								<div
									style={{
										position: "absolute",
										top: "50%",
										left: "50%",
										transform: "translate(-50%, -50%)",
									}}
								>
									<Spin size="small" />
								</div>
							) : null}
						</div>
						<UploadAction
							handler={uploadHandler}
							onFileChange={handleFileChange}
							multiple={false}
							accept="image/*"
						/>
					</div>
				) : null}

				{canUpdateNickname ? (
					<div className={styles.formSection}>
						<label className={styles.label}>{t("username") || "用户名"}</label>
						<div className={styles.inputWrapper}>
							<Input
								className={styles.input}
								value={nickname}
								onChange={(event) => setNickname(event.target.value)}
								placeholder={
									t("usernamePlaceholder") ||
									tInterface("setting.nickNamePlaceholder")
								}
								disabled={isSaving}
								data-testid="account-setting-nickname-input"
							/>
						</div>
					</div>
				) : null}
			</div>
		</MagicModal>
	)
}

export default memo(observer(EditProfileModal))
