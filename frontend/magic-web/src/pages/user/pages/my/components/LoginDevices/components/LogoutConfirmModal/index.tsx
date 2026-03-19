import { memo, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import VerificationCodeInput from "@/components/business/VerificationCodeInput"
import VerificationCodeButton from "@/components/business/VerificationCodeButton"
import { VerificationCode } from "@/constants/bussiness"
import type { LogoutConfirmModalProps } from "../../types"
import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { useMemoizedFn } from "ahooks"

/**
 * LogoutConfirmModal - Device logout confirmation modal
 *
 * @param props - Modal props
 * @returns JSX.Element
 */
const LogoutConfirmModal = memo((props: LogoutConfirmModalProps) => {
	const { open, onCancel, onTrigger, onInputComplete } = props
	const { t } = useTranslation("interface")

	const [code, setCode] = useState("")

	const handleCodeChange = useMemoizedFn((value: string) => {
		setCode(value)
	})

	const onOpenChange = useMemoizedFn((open: boolean) => {
		if (!open) {
			onCancel()
		}
	})

	useEffect(() => {
		setCode("")
	}, [open])

	return (
		<ActionDrawer
			open={open}
			onOpenChange={onOpenChange}
			title={t("setting.loginDevices.logoutConfirmTitle")}
		>
			<div>{t("setting.loginDevices.logoutConfirmContent")}</div>
			<VerificationCodeInput
				value={code}
				onChange={handleCodeChange}
				onInputComplete={onInputComplete}
			/>
			<VerificationCodeButton
				type="link"
				codeType={VerificationCode.DeviceLogout}
				autoFetch
				trigger={onTrigger}
			/>
		</ActionDrawer>
	)
})

export default LogoutConfirmModal
