import MagicButton from "@/components/base/MagicButton"
import UploadAction from "@/components/base/UploadAction"
import { useUserInfo } from "@/models/user/hooks"
import { useMemoizedFn } from "ahooks"
import { Flex, Spin } from "antd"
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
				style={{ cursor: isUploading ? "not-allowed" : "pointer" }}
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
		<Flex align="center" gap={4} data-testid="user-avatar-setting">
			<div style={{ position: "relative" }}>
				<UserAvatarRender
					userInfo={info}
					size={size}
					style={{
						opacity: isUploading ? 0.6 : 1,
						transition: "opacity 0.3s ease",
					}}
				/>
				{isUploading && (
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
		</Flex>
	)
})

export default SettingUserAvatar
