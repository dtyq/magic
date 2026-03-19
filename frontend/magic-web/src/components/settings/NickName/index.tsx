import { Flex, Input } from "antd"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import SettingStore from "@/stores/setting"
import { useUserInfo } from "@/models/user/hooks"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useMemo, useState } from "react"
import MagicButton from "@/components/base/MagicButton"
import { MagicUserApi } from "@/apis"
import { createStyles, useTheme } from "antd-style"
import { service } from "@/services"
import type { UserService } from "@/services/user/UserService"
import magicToast from "@/components/base/MagicToaster/utils"

const useStyles = createStyles(({ css, token }) => ({
	nickname: css`
		border: 1px solid ${token.colorBorder};
		border-radius: ${token.borderRadiusLG}px;
		width: 200px;
		padding-right: 4px;

		&:focus-within {
			border-color: ${token.colorPrimary};
		}
	`,
	input: css`
		flex: 1;
		padding-right: 4px;
		padding-left: 8px;
	`,
}))

const NickName = observer(function NickName() {
	const { t } = useTranslation("interface")
	const { userInfo: info } = useUserInfo()
	const { styles } = useStyles()
	const { magicColorUsages } = useTheme()

	const [value, setValue] = useState(info?.nickname)
	const [showEdit, setShowEdit] = useState(false)

	const { canUpdateNickname } = SettingStore

	// 值变化时，判断显示编辑按钮
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
		<Flex
			align="center"
			className={styles.nickname}
			style={{
				backgroundColor: canUpdateNickname ? undefined : magicColorUsages.fill[0],
			}}
		>
			<Input
				className={styles.input}
				variant="borderless"
				value={value}
				placeholder={t("setting.nickNamePlaceholder")}
				disabled={!canUpdateNickname}
				onChange={(e) => {
					setValue(e.target.value)
				}}
			/>
			{suffix}
		</Flex>
	)
})

export default NickName
