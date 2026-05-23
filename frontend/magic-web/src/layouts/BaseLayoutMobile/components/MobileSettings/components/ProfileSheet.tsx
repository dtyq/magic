import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { MagicUserApi } from "@/apis"
import { useUserInfo } from "@/models/user/hooks"
import { useAvatarUpload } from "@/components/settings/UserAvatar/hooks/useAvatarUpload"
import { service } from "@/services"
import SettingService from "@/services/setting"
import type { UserService } from "@/services/user/UserService"
import SettingStore from "@/stores/setting"
import { MobileSettingsSheetContainer } from "./SheetContainer"
import { MobileSettingsProfileView } from "./ProfileView"

/** 个人资料 Sheet 容器：仅处理 avatar_url / nickname，权限与 PC EditProfileModal 对齐。 */
export const MobileSettingsProfileSheet = observer(function MobileSettingsProfileSheet(props: {
	open: boolean
	onClose: () => void
}) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const { userInfo } = useUserInfo()
	const { canUpdateAvatar, canUpdateNickname } = SettingStore
	const { uploadAvatar, isUploading } = useAvatarUpload()
	const avatarInputRef = useRef<HTMLInputElement | null>(null)
	const [draftNickname, setDraftNickname] = useState(userInfo?.nickname || "")
	const [isSaving, setIsSaving] = useState(false)

	const currentNickname = userInfo?.nickname || ""
	const trimmedDraftNickname = draftNickname.trim()
	const hasNicknameChanges = trimmedDraftNickname !== currentNickname
	const canSaveNickname =
		canUpdateNickname &&
		Boolean(trimmedDraftNickname) &&
		hasNicknameChanges &&
		!isSaving &&
		!isUploading

	useEffect(() => {
		if (!open) return
		void SettingService.getUpdateUserInfoPermission()
		setDraftNickname(currentNickname)
	}, [currentNickname, open])

	/** 头像按钮只负责触发原生文件选择；无 avatar_url 权限时不响应。 */
	const handlePickAvatar = useMemoizedFn(() => {
		if (!canUpdateAvatar || isUploading) return
		avatarInputRef.current?.click()
	})

	/** 文件选择后交给 useAvatarUpload，选图即保存 avatar_url。 */
	const handleAvatarFileChange = useMemoizedFn(async (event: ChangeEvent<HTMLInputElement>) => {
		if (!canUpdateAvatar) return
		const files = event.target.files
		if (files?.length) await uploadAvatar(files)
		event.target.value = ""
	})

	/** 仅在有 nickname 权限且内容变更时提交昵称。 */
	const handleConfirm = useMemoizedFn(async () => {
		if (!canUpdateNickname) return
		const nextNickname = trimmedDraftNickname
		if (isSaving || isUploading || !nextNickname) return

		if (!hasNicknameChanges) {
			onClose()
			return
		}

		setIsSaving(true)
		try {
			await MagicUserApi.updateUserInfo({ nickname: nextNickname })
			await service.get<UserService>("userService").refreshUserInfo()
			toast.success(t("setting.updateNickname.success"))
			onClose()
		} catch {
			toast.error(t("setting.updateNickname.failed"))
		} finally {
			setIsSaving(false)
		}
	})

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.profile")}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			onConfirm={canUpdateNickname ? handleConfirm : undefined}
			confirmDisabled={!canSaveNickname}
			dataTestId="mobile-settings-profile-sheet"
		>
			{canUpdateAvatar ? (
				<input
					ref={avatarInputRef}
					type="file"
					accept="image/*"
					className="sr-only"
					aria-hidden
					onChange={handleAvatarFileChange}
					data-testid="mobile-settings-profile-avatar-input"
				/>
			) : null}
			<MobileSettingsProfileView
				avatar={userInfo?.avatar}
				nickname={draftNickname}
				canUpdateAvatar={canUpdateAvatar}
				canUpdateNickname={canUpdateNickname}
				onNicknameChange={setDraftNickname}
				onPickAvatar={handlePickAvatar}
				onConfirm={handleConfirm}
				onCancel={onClose}
				isAvatarActionDisabled={isUploading}
				nicknameLabel={t("setting.nickName")}
				nicknamePlaceholder={t("setting.nickName")}
				avatarAriaLabel={t("setting.uploadAvatar.title")}
			/>
		</MobileSettingsSheetContainer>
	)
})
