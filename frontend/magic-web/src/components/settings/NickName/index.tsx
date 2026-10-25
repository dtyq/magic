import { Input } from "antd"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import SettingStore from "@/stores/setting"
import { useUserInfo } from "@/models/user/hooks"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useMemo, useState } from "react"
import MagicButton from "@/components/base/MagicButton"
import { MagicUserApi } from "@/apis"
import { cn } from "@/utils/cn"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import magicToast from "@/components/base/MagicToaster/utils"

const NickName = observer(function NickName() {
	const { t } = useTranslation("interface")
	const { userInfo: info } = useUserInfo()

	const [value, setValue] = useState(info?.nickname)
	const [showEdit, setShowEdit] = useState(false)

	const { canUpdateNickname } = SettingStore

	// Show confirmation only after the local nickname differs from the saved profile.
	useUpdateEffect(() => {
		setShowEdit(value !== info?.nickname)
	}, [value])

	const [submitting, setSubmitting] = useState(false)
	const handleConfirm = useMemoizedFn(() => {
		setSubmitting(true)
		MagicUserApi.updateUserInfo({
			nickname: value,
		})
			.then(() => {
				magicToast.success(t("setting.updateNickname.success"))
				service.get<UserService>("userService").refreshUserInfo()
				setShowEdit(false)
			})
			.catch(() => {
				magicToast.error(t("setting.updateNickname.failed"))
			})
			.finally(() => {
				setSubmitting(false)
			})
	})

	const suffix = useMemo(() => {
		return showEdit ? (
			<MagicButton
				size="small"
				loading={submitting}
				disabled={!canUpdateNickname}
				onClick={handleConfirm}
			>
				{t("common.confirm")}
			</MagicButton>
		) : null
	}, [canUpdateNickname, handleConfirm, showEdit, submitting, t])

	return (
		<div
			className={cn(
				"flex w-[200px] items-center rounded-[8px] border border-border pr-1 focus-within:border-primary",
				!canUpdateNickname && "bg-fill dark:bg-white/10",
			)}
		>
			<Input
				className="flex-1 !pl-2 !pr-1"
				variant="borderless"
				value={value}
				placeholder={t("setting.nickNamePlaceholder")}
				disabled={!canUpdateNickname}
				onChange={(e) => {
					setValue(e.target.value)
				}}
			/>
			{suffix}
		</div>
	)
})

export default NickName
