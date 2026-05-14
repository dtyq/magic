import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useMemoizedFn } from "ahooks"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { MagicUserApi } from "@/apis"
import { useUserInfo } from "@/models/user/hooks"
import { useAvatarUpload } from "@/components/settings/UserAvatar/hooks/useAvatarUpload"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import { MobileSettingsSheetContainer } from "./SheetContainer"
import { MobileSettingsProfileView } from "./ProfileView"

/** 个人资料 Sheet 容器负责真实数据链路，View 只接收展示状态和事件回调。 */
export function MobileSettingsProfileSheet(props: { open: boolean; onClose: () => void }) {
	const { open, onClose } = props
	const { t } = useTranslation("interface")
	const { userInfo } = useUserInfo()
	const { uploadAvatar, isUploading } = useAvatarUpload()
	const avatarInputRef = useRef<HTMLInputElement | null>(null)
	const [draftNickname, setDraftNickname] = useState(userInfo?.nickname || "")
	const [isSaving, setIsSaving] = useState(false)

	const currentNickname = userInfo?.nickname || ""
	const canSave = Boolean(draftNickname.trim()) && !isSaving && !isUploading

	useEffect(() => {
		if (open) setDraftNickname(currentNickname)
	}, [currentNickname, open])

	/** 头像按钮只负责触发原生文件选择，上传校验和保存继续复用 useAvatarUpload。 */
	const handlePickAvatar = useMemoizedFn(() => {
		if (isUploading) return
		avatarInputRef.current?.click()
	})

	/** 文件选择后交给现有头像上传 hook，确保压缩、上传、保存和 toast 口径一致。 */
	const handleAvatarFileChange = useMemoizedFn(async (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files
		if (files?.length) await uploadAvatar(files)
		event.target.value = ""
	})

	/** 保存昵称时沿用旧个人资料页的 API 和刷新链路，避免在设置页重复实现业务规则。 */
	const handleConfirm = useMemoizedFn(async () => {
		const nextNickname = draftNickname.trim()
		if (isSaving || isUploading || !nextNickname) return

		if (nextNickname === currentNickname) {
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
			onConfirm={handleConfirm}
			confirmDisabled={!canSave}
			dataTestId="mobile-settings-profile-sheet"
		>
			<input
				ref={avatarInputRef}
				type="file"
				accept="image/*"
				className="sr-only"
				aria-hidden
				onChange={handleAvatarFileChange}
				data-testid="mobile-settings-profile-avatar-input"
			/>
			<MobileSettingsProfileView
				avatar={userInfo?.avatar}
				nickname={draftNickname}
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
}
