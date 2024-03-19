import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useNavigate } from "@/opensource/routes/hooks/useNavigate"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useUserInfo } from "@/opensource/models/user/hooks"
import { useAvatarUpload } from "@/opensource/components/settings/UserAvatar/hooks/useAvatarUpload"
import UploadAction from "@/opensource/components/base/UploadAction"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { MagicUserApi } from "@/opensource/apis"
import { service } from "@/opensource/services"
import type { UserService } from "@/opensource/services/user/UserService"
import { ActionDrawer } from "@/opensource/components/shadcn-composed/action-drawer"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import SettingItem from "../common/SettingItem"

function AccountInfo() {
	const { t } = useTranslation("interface")

	const navigate = useNavigate()

	const { userInfo } = useUserInfo()

	const { uploadAvatar, isUploading } = useAvatarUpload()

	const [open, setOpen] = useState(false)
	const [nickname, setNickname] = useState(userInfo?.nickname || "")
	const [isSaving, setIsSaving] = useState(false)

	// 返回上一页
	const handleBack = useMemoizedFn(() => {
		navigate({
			delta: -1,
			viewTransition: {
				type: "slide",
				direction: "right",
			},
		})
	})

	const handleFileChange = useMemoizedFn(async (files: FileList | File[]) => {
		await uploadAvatar(files)
	})

	const UploadHandler = useMemoizedFn((onUpload: () => void) => {
		const handleClick = () => {
			if (isUploading) return
			onUpload()
		}

		return (
			<SettingItem
				label={t("setting.avatar")}
				value={
					<MagicAvatar src={userInfo?.avatar} size={40}>
						{userInfo?.nickname}
					</MagicAvatar>
				}
				onClick={handleClick}
			/>
		)
	})

	const handleNicknameChange = useMemoizedFn(async (nickname: string) => {
		try {
			await MagicUserApi.updateUserInfo({ nickname })
			await service.get<UserService>("userService").refreshUserInfo()
			toast.success(t("setting.updateNickname.success"))
		} catch (error) {
			toast.error(t("setting.updateNickname.failed"))
		}
	})

	const handleNicknameClick = useMemoizedFn(() => {
		setNickname(userInfo?.nickname || "")
		setOpen(true)
	})

	const onOpenChange = useMemoizedFn((open: boolean) => {
		setOpen(open)
		setNickname(userInfo?.nickname || "")
	})

	const handleCancel = useMemoizedFn(() => {
		setOpen(false)
		setNickname(userInfo?.nickname || "")
	})

	const handleSave = useMemoizedFn(async () => {
		const newNickname = nickname.trim()
		if (isSaving || !newNickname) return
		if (newNickname === userInfo?.nickname) {
			setOpen(false)
			return
		}
		setIsSaving(true)
		await handleNicknameChange(newNickname)
		setIsSaving(false)
		setOpen(false)
	})

	return (
		<div className="flex h-full w-full flex-col bg-sidebar">
			{/* Header */}
			<div className="mb-3.5 w-full overflow-hidden rounded-bl-xl rounded-br-xl bg-background shadow-xs">
				<div className="flex h-12 w-full items-center gap-2 overflow-hidden px-2.5 py-0">
					<Button
						onClick={handleBack}
						variant="ghost"
						className="size-8 shrink-0 rounded-lg bg-transparent p-0"
					>
						<ChevronLeft className="size-6 text-foreground" />
					</Button>
					<div className="text-base font-medium text-foreground">
						{t("setting.personalInfo")}
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="flex w-full flex-1 flex-col gap-4 overflow-hidden px-3.5">
				{/* 头像设置 */}
				<div className="flex w-full flex-col overflow-hidden rounded-md bg-popover">
					<UploadAction
						handler={UploadHandler}
						onFileChange={handleFileChange}
						multiple={false}
						accept="image/*"
					/>
				</div>

				{/* 用户名设置 */}
				<div className="flex w-full flex-col overflow-hidden rounded-md bg-popover">
					<SettingItem
						label={t("setting.nickName")}
						value={
							<div className="whitespace-nowrap text-sm text-foreground">
								{userInfo?.nickname}
							</div>
						}
						onClick={handleNicknameClick}
					/>
				</div>
			</div>

			{/* Drawer */}
			<ActionDrawer
				open={open}
				onOpenChange={onOpenChange}
				title={t("setting.nickName")}
				showCancel={false}
			>
				<Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
				<div className="flex gap-1.5">
					<Button variant="outline" className="px-8" onClick={handleCancel}>
						{t("button.cancel")}
					</Button>
					<Button className="flex-1" onClick={handleSave} disabled={isSaving}>
						{t("button.save")}
					</Button>
				</div>
			</ActionDrawer>
		</div>
	)
}

export default observer(AccountInfo)
