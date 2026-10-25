import { createElement, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useForm } from "antd/es/form/Form"
import { IconCheck, IconDeviceMobile, IconMail } from "@tabler/icons-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { UserApi } from "@/apis"
import MagicModal from "@/components/base/MagicModal"
import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { Button } from "@/components/shadcn-ui/button"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { EmailVerify } from "./EmailVerify"
import { PhoneVerify } from "./PhoneVerify"
import type { VerifyForm } from "./types"

const verifyStrategyMap = {
	email: EmailVerify,
	phone: PhoneVerify,
	none: () => null,
}

type VerifyStrategy = keyof typeof verifyStrategyMap
type SelectableVerifyStrategy = Exclude<VerifyStrategy, "none">

function resolveVerifyStrategy(
	selectedStrategy: SelectableVerifyStrategy | null,
	hasPhone: boolean,
	hasEmail: boolean,
): VerifyStrategy {
	if (selectedStrategy === "phone" && hasPhone) return "phone"
	if (selectedStrategy === "email" && hasEmail) return "email"
	if (hasPhone) return "phone"
	if (hasEmail) return "email"
	return "none"
}

interface ChangePasswordModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	userPhone?: string | null
	userEmail?: string | null
}

export function ChangePasswordModal({
	open,
	onOpenChange,
	userPhone,
	userEmail,
}: ChangePasswordModalProps) {
	const { t } = useTranslation("interface")
	const { t: tMessage } = useTranslation("message")
	const isMobile = useIsMobile()
	const [passwordForm] = useForm<VerifyForm>()
	const [isSaving, setIsSaving] = useState(false)
	const [selectedStrategy, setSelectedStrategy] = useState<SelectableVerifyStrategy | null>(null)
	const hasPhone = Boolean(userPhone?.trim())
	const hasEmail = Boolean(userEmail?.trim())
	const strategy = resolveVerifyStrategy(selectedStrategy, hasPhone, hasEmail)

	const handleChangePassword = useMemoizedFn(async () => {
		if (isSaving) return

		try {
			setIsSaving(true)
			const values = await passwordForm.validateFields()
			await UserApi.changePassword(values.code, values.password, values.password)
			toast.success(tMessage("setting.changePasswordSuccess"))
			passwordForm.resetFields()
			onOpenChange(false)
		} catch (error) {
			console.error("Failed to change password:", error)
			toast.error(tMessage("setting.changePasswordFailed"))
		} finally {
			setIsSaving(false)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		passwordForm.resetFields()
		onOpenChange(false)
	})

	const handleOpenChange = useMemoizedFn((nextOpen: boolean) => {
		if (!nextOpen) passwordForm.resetFields()
		onOpenChange(nextOpen)
	})

	const strategySelector = (
		<div className="flex w-full items-center gap-4">
			{hasPhone ? (
				<div
					onClick={() => setSelectedStrategy("phone")}
					className={cn(
						"flex cursor-pointer items-center gap-2 rounded-md border border-border p-2",
						{
							"border-primary text-primary": strategy === "phone",
						},
					)}
				>
					<IconDeviceMobile size={20} />
					{t("setting.mobileVerify")}
					{strategy === "phone" ? (
						<IconCheck size={20} style={{ marginLeft: "auto" }} />
					) : null}
				</div>
			) : null}
			{hasEmail ? (
				<div
					onClick={() => setSelectedStrategy("email")}
					className={cn(
						"flex cursor-pointer items-center gap-2 rounded-md border border-border p-2",
						{
							"border-primary text-primary": strategy === "email",
						},
					)}
				>
					<IconMail size={20} />
					{t("setting.emailVerify")}
					{strategy === "email" ? (
						<IconCheck size={20} style={{ marginLeft: "auto" }} />
					) : null}
				</div>
			) : null}
		</div>
	)

	const formContent = (
		<>
			{strategySelector}
			{createElement(verifyStrategyMap[strategy], { form: passwordForm })}
		</>
	)

	const actionButtons = (
		<div className={cn("flex gap-1.5", { "justify-end": !isMobile })}>
			<Button variant="outline" className="px-8" onClick={handleCancel}>
				{t("button.cancel")}
			</Button>
			<Button
				className={isMobile ? "flex-1" : "px-8"}
				onClick={handleChangePassword}
				disabled={isSaving || strategy === "none"}
			>
				{t("setting.resetPassword")}
			</Button>
		</div>
	)

	if (isMobile) {
		return (
			<ActionDrawer
				open={open}
				onOpenChange={handleOpenChange}
				title={t("setting.changeLoginPassword")}
				showCancel={false}
			>
				{formContent}
				{actionButtons}
			</ActionDrawer>
		)
	}

	return (
		<MagicModal
			title={t("setting.changeLoginPassword")}
			open={open}
			onCancel={handleCancel}
			footer={null}
			closable
			centered
			width={580}
		>
			<div className="flex flex-col gap-3">
				{formContent}
				{actionButtons}
			</div>
		</MagicModal>
	)
}

export default ChangePasswordModal
