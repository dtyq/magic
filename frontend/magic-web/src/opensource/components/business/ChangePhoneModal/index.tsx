import { useState } from "react"
import { useMemoizedFn } from "ahooks"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { mutate } from "swr"

import { UserApi } from "@/opensource/apis"
import { VerificationCode } from "@/opensource/constants/bussiness"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { service } from "@/opensource/services"
import type { LoginService } from "@/opensource/services/user/LoginService"
import { validatePhone } from "@/opensource/utils/phone"
import { ActionDrawer } from "@/opensource/components/shadcn-composed/action-drawer"
import VerificationCodeButton from "@/opensource/components/business/VerificationCodeButton"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Field, FieldError, FieldLabel } from "@/opensource/components/shadcn-ui/field"
import { Input } from "@/opensource/components/shadcn-ui/input"
import MagicModal from "@/opensource/components/base/MagicModal"
import PhoneStateCodeSelect from "@/opensource/components/other/PhoneStateCodeSelect"
import { cn } from "@/opensource/lib/utils"

interface ChangePhoneModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	currentPhone?: string
	defaultCountryCode?: string
}

export function ChangePhoneModal({
	open,
	onOpenChange,
	currentPhone = "",
	defaultCountryCode = "+86",
}: ChangePhoneModalProps) {
	const { t } = useTranslation("interface")
	const isMobile = useIsMobile()
	const [phoneStateCode, setPhoneStateCode] = useState(defaultCountryCode)
	const [code, setCode] = useState("")
	const [newPhone, setNewPhone] = useState("")
	const [newPhoneCode, setNewPhoneCode] = useState("")
	const [isSaving, setIsSaving] = useState(false)
	const [errors, setErrors] = useState<{
		code?: string
		newPhone?: string
		newPhoneCode?: string
	}>({})

	const validatePhoneForm = useMemoizedFn(() => {
		const nextErrors: typeof errors = {}

		if (!code) {
			nextErrors.code = resolveToString(t("form.required"), {
				label: t("setting.VerificationCode"),
			})
		}

		if (!newPhone) {
			nextErrors.newPhone = resolveToString(t("form.required"), {
				label: t("setting.newPhone"),
			})
		} else if (!validatePhone(newPhone, phoneStateCode)) {
			nextErrors.newPhone = t("setting.invalidPhone")
		} else if (newPhone === currentPhone) {
			nextErrors.newPhone = t("setting.samePhone")
		}

		if (!newPhoneCode) {
			nextErrors.newPhoneCode = resolveToString(t("form.required"), {
				label: t("setting.newPhoneCode"),
			})
		}

		setErrors(nextErrors)
		return Object.keys(nextErrors).length === 0
	})

	const resetForm = useMemoizedFn(() => {
		setCode("")
		setNewPhone("")
		setNewPhoneCode("")
		setErrors({})
		setPhoneStateCode(defaultCountryCode)
	})

	const handleChangePhone = useMemoizedFn(async () => {
		if (isSaving) return
		if (!validatePhoneForm()) return

		try {
			setIsSaving(true)
			await UserApi.changePhone(code, newPhone, newPhoneCode, phoneStateCode)
			toast.success(t("setting.changePhoneSuccess", { ns: "message" }))
			mutate("/v4/users/info")
			resetForm()
			onOpenChange(false)
		} catch (error) {
			console.error("Failed to change phone:", error)
			toast.error(t("setting.changePhoneFailed", { ns: "message" }))
		} finally {
			setIsSaving(false)
		}
	})

	const handleCancel = useMemoizedFn(() => {
		resetForm()
		onOpenChange(false)
	})

	const handleOpenChange = useMemoizedFn((nextOpen: boolean) => {
		if (!nextOpen) resetForm()
		onOpenChange(nextOpen)
	})

	const formContent = (
		<div className="flex flex-col gap-4">
			<Field className="gap-2" data-invalid={!!errors.code}>
				<FieldLabel className="text-sm font-medium text-foreground">
					{t("setting.VerificationCode")}
				</FieldLabel>
				<div className="flex items-center gap-1">
					<Input
						value={code}
						onChange={(event) => {
							setCode(event.target.value)
							setErrors((prev) => ({ ...prev, code: undefined }))
						}}
						placeholder={resolveToString(t("form.required"), {
							label: t("setting.VerificationCode"),
						})}
						className="h-9 flex-1 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-xs"
					/>
					<VerificationCodeButton
						className="h-9"
						phone={currentPhone}
						codeType={VerificationCode.ChangePhone}
						trigger={service.get<LoginService>("loginService").getUsersVerificationCode}
					/>
				</div>
				{errors.code ? <FieldError>{errors.code}</FieldError> : null}
			</Field>

			<Field className="gap-2" data-invalid={!!errors.newPhone}>
				<FieldLabel className="text-sm font-medium text-foreground">
					{t("setting.newPhone")}
				</FieldLabel>
				<div className="flex w-full items-start gap-1">
					<div className="shrink-0">
						<PhoneStateCodeSelect value={phoneStateCode} onChange={setPhoneStateCode} />
					</div>
					<Input
						value={newPhone}
						onChange={(event) => {
							setNewPhone(event.target.value)
							setErrors((prev) => ({ ...prev, newPhone: undefined }))
						}}
						placeholder={resolveToString(t("form.required"), {
							label: t("setting.newPhone"),
						})}
						className="h-9 flex-1 gap-1 overflow-hidden rounded-md border border-input bg-white px-3 py-1 text-sm leading-5 shadow-xs"
					/>
				</div>
				{errors.newPhone ? <FieldError>{errors.newPhone}</FieldError> : null}
			</Field>

			<Field className="gap-2" data-invalid={!!errors.newPhoneCode}>
				<FieldLabel className="text-sm font-medium text-foreground">
					{t("setting.newPhoneCode")}
				</FieldLabel>
				<div className="flex items-center gap-1">
					<Input
						value={newPhoneCode}
						onChange={(event) => {
							setNewPhoneCode(event.target.value)
							setErrors((prev) => ({ ...prev, newPhoneCode: undefined }))
						}}
						placeholder={resolveToString(t("form.required"), {
							label: t("setting.newPhoneCode"),
						})}
						className="h-9 flex-1 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-xs"
					/>
					<VerificationCodeButton
						className="h-9"
						phone={newPhone}
						stateCode={phoneStateCode}
						codeType={VerificationCode.BindPhone}
						trigger={service.get<LoginService>("loginService").getPhoneVerificationCode}
						disabled={!newPhone || !validatePhone(newPhone, phoneStateCode)}
					/>
				</div>
				{errors.newPhoneCode ? <FieldError>{errors.newPhoneCode}</FieldError> : null}
			</Field>
		</div>
	)

	const actionButtons = (
		<div className={cn("flex gap-1.5", { "justify-end": !isMobile })}>
			<Button variant="outline" className="px-8" onClick={handleCancel}>
				{t("button.cancel")}
			</Button>
			<Button
				className={isMobile ? "flex-1" : "px-8"}
				onClick={handleChangePhone}
				disabled={isSaving}
			>
				{t("button.save")}
			</Button>
		</div>
	)

	if (isMobile) {
		return (
			<ActionDrawer
				open={open}
				onOpenChange={handleOpenChange}
				title={t("setting.changePhone")}
				showCancel={false}
			>
				{formContent}
				{actionButtons}
			</ActionDrawer>
		)
	}

	return (
		<MagicModal
			title={t("setting.changePhone")}
			open={open}
			onCancel={handleCancel}
			footer={null}
			closable
			centered
		>
			{formContent}
			<div className="mt-6">{actionButtons}</div>
		</MagicModal>
	)
}

export default ChangePhoneModal
