import MagicButton from "@/components/base/MagicButton"
import UploadAction from "@/components/base/UploadAction"
import { useUserInfo } from "@/models/user/hooks"
import { useMemoizedFn } from "ahooks"
import { Spin } from "antd"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import { useAvatarUpload } from "./hooks/useAvatarUpload"
import SettingStore from "@/stores/setting"
import { observer } from "mobx-react-lite"
import UserAvatarRender from "@/components/business/UserAvatarRender"

interface SettingUserAvatarProps {
	size?: number
	showUploadText?: boolean
}

const SettingUserAvatar = observer(function SettingUserAvatar({
	size = 40,
	showUploadText = true,
}: SettingUserAvatarProps) {
	const { userInfo: info } = useUserInfo()
	const { t } = useTranslation("interface")

	const { canUpdateAvatar } = SettingStore
	const { uploadAvatar, isUploading } = useAvatarUpload()

	const UploadHandler = useMemoizedFn((onUpload) => {
		return (
			<MagicButton
				type="link"
				onClick={onUpload}
				loading={isUploading}
				disabled={isUploading}
				className={isUploading ? "!cursor-not-allowed" : "cursor-pointer"}
				aria-label={t("setting.uploadAvatar.title")}
				data-testid="avatar-upload-button"
			>
				{showUploadText &&
					(isUploading
						? t("setting.uploadAvatar.uploading")
						: t("setting.uploadAvatar.title"))}
			</MagicButton>
		)
	})

	const handleFileChange = useMemoizedFn(async (fileList: FileList | File[]) => {
		await uploadAvatar(fileList)
	})

	return (
		<div className="flex items-center gap-1" data-testid="user-avatar-setting">
			<div className="relative">
				<UserAvatarRender
					userInfo={info}
					size={size}
					className={cn(
						"transition-opacity duration-300 [transition-timing-function:ease]",
						isUploading && "opacity-60",
					)}
				/>
				{/* Center upload progress over the avatar regardless of its configured size. */}
				{isUploading && (
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
						<Spin size="small" />
					</div>
				)}
			</div>

			{canUpdateAvatar && (
				<UploadAction
					handler={UploadHandler}
					onFileChange={handleFileChange}
					multiple={false}
					accept="image/*"
					data-testid="avatar-upload-action"
				/>
			)}
		</div>
	)
})

export default SettingUserAvatar
