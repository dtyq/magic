import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { Check, Eye, EyeOff, Mail, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"

import { UserApi } from "@/apis"
import VerificationCodeButton from "@/components/business/VerificationCodeButton"
import VerificationCodeInput from "@/components/business/VerificationCodeInput"
import { Input } from "@/components/shadcn-ui/input"
import { VerificationCode } from "@/constants/bussiness"
import { encryptPhoneWithCountryCode } from "@/utils/phone"
import { cn } from "@/lib/utils"

import { MobileSettingsSheetContainer } from "./SheetContainer"

export type MobileSettingsPasswordMethod = "phone" | "email"

interface MobileSettingsPasswordSheetProps {
	open: boolean
	onClose: () => void
	hasPhone: boolean
	hasEmail: boolean
	currentPhone?: string
	currentEmail?: string
	countryCode?: string
}

const MIN_PASSWORD_LENGTH = 8
const VERIFICATION_CODE_LENGTH = 6
const SUCCESS_AUTO_CLOSE_MS = 1500

/** Compact send-code control aligned with phone/email row (same as PhoneSecuritySheet). */
const INLINE_SEND_CODE_BUTTON_CLASS =
	"h-12 shrink-0 rounded-lg border-0 !bg-foreground px-3 text-sm font-medium !text-background shadow-none hover:!bg-foreground/90 active:opacity-80 disabled:!bg-foreground/40 disabled:!text-background/70"

// TODO(mobile-refactor-cleanup): Prototype included "original password" verification; no API in repo yet.
// TODO(email-change-api): Email change (bind/rebind) needs PUT /v4/users/email + send-email types; out of scope here.

/**
 * Mobile change-password sheet: tabbed phone/email verify + new password on one page;
 * Header confirm submits once via PUT /v4/users/pwd (no per-step verification session).
 */
export function MobileSettingsPasswordSheet({
	open,
	onClose,
	hasPhone,
	hasEmail,
	currentPhone,
	currentEmail,
	countryCode = "+86",
}: MobileSettingsPasswordSheetProps) {
	const { t } = useTranslation("interface")
	const [method, setMethod] = useState<MobileSettingsPasswordMethod>(() =>
		hasPhone ? "phone" : "email",
	)
	const [view, setView] = useState<"form" | "success">("form")
	const [code, setCode] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [isSaving, setIsSaving] = useState(false)
	const [hasSentCode, setHasSentCode] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [error, setError] = useState<string>()

	const verifyTarget = method === "phone" ? currentPhone : currentEmail

	/** Auto-close success view after brief feedback. */
	useEffect(() => {
		if (view !== "success") return

		const timer = window.setTimeout(() => {
			onClose()
		}, SUCCESS_AUTO_CLOSE_MS)

		return () => window.clearTimeout(timer)
	}, [onClose, view])

	/** Reset form when sheet opens or verification method changes. */
	useEffect(() => {
		if (!open) return

		setMethod(hasPhone ? "phone" : "email")
		resetFormState()
	}, [hasPhone, open])

	/** Clear verification and password fields when switching phone/email tab. */
	function handleMethodChange(nextMethod: MobileSettingsPasswordMethod) {
		if (nextMethod === method) return
		setMethod(nextMethod)
		resetFormState()
	}

	function resetFormState() {
		setView("form")
		setCode("")
		setPassword("")
		setConfirmPassword("")
		setHasSentCode(false)
		setShowPassword(false)
		setShowConfirmPassword(false)
		setError(undefined)
	}

	/** Send verification code for the active method (phone SMS or email channel). */
	const handleSendCode = useMemoizedFn(async (codeType: VerificationCode, target: string) => {
		await UserApi.getUsersVerificationCode(codeType, target)
		setHasSentCode(true)
		setCode("")
		setError(undefined)
	})

	/** Validate code + passwords locally, then submit changePassword in one request. */
	const handleSubmit = useMemoizedFn(async () => {
		if (isSaving) return

		const validationError = resolveSubmitValidationError(
			t,
			code,
			password,
			confirmPassword,
			hasSentCode,
		)
		if (validationError) {
			setError(validationError)
			return
		}

		try {
			setIsSaving(true)
			await UserApi.changePassword(code, password, password)
			toast.success(t("setting.changePasswordSuccess", { ns: "message" }))
			setView("success")
		} catch (submitError) {
			console.error("Failed to change password:", submitError)
			toast.error(t("setting.changePasswordFailed", { ns: "message" }))
		} finally {
			setIsSaving(false)
		}
	})

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={
				view === "success"
					? t("setting.accountSecurityPassword.successTitle")
					: t("setting.changeLoginPassword")
			}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			onCloseClick={onClose}
			onConfirm={view === "form" ? handleSubmit : undefined}
			confirmAriaLabel={t("setting.resetPassword")}
			confirmDisabled={isSaving}
			hideCloseButton={view === "success"}
			contentClassName="gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-password-sheet"
		>
			{view === "form" ? (
				<>
					<PasswordMethodTabs
						method={method}
						hasPhone={hasPhone}
						hasEmail={hasEmail}
						onChange={handleMethodChange}
					/>
					<div className="px-3.5 text-[15px] leading-5 text-muted-foreground">
						{t("setting.accountSecurityPassword.verifyDescription")}
					</div>
					<PasswordReadonlyTarget
						method={method}
						currentPhone={currentPhone}
						currentEmail={currentEmail}
						countryCode={countryCode}
						sendCodeButton={
							<VerificationCodeButton
								type="default"
								className={INLINE_SEND_CODE_BUTTON_CLASS}
								phone={verifyTarget}
								codeType={VerificationCode.ChangePassword}
								trigger={handleSendCode}
								disabled={!verifyTarget || isSaving}
								data-testid="mobile-settings-password-send-code-button"
							/>
						}
					/>
					<PasswordField label={t("setting.VerificationCode")}>
						<div className="flex flex-col gap-3">
							<VerificationCodeInput
								value={code}
								onChange={(value) => {
									setCode(value)
									setError(undefined)
								}}
								disabled={!hasSentCode || isSaving}
								autoFocus={false}
								showError={false}
								containerClassName="w-full justify-between gap-2"
								slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
							/>
						</div>
					</PasswordField>
					<div className="px-3.5 text-[15px] leading-5 text-muted-foreground">
						{t("setting.accountSecurityPassword.setNewDescription", {
							min: MIN_PASSWORD_LENGTH,
						})}
					</div>
					<PasswordField label={t("setting.newPassword")}>
						<PasswordInput
							value={password}
							onChange={(value) => {
								setPassword(value)
								setError(undefined)
							}}
							visible={showPassword}
							onToggleVisible={() => setShowPassword((prev) => !prev)}
							placeholder={t(
								"setting.accountSecurityPassword.newPasswordPlaceholder",
								{
									min: MIN_PASSWORD_LENGTH,
								},
							)}
							dataTestId="mobile-settings-password-new-input"
						/>
					</PasswordField>
					<PasswordField
						label={t("setting.accountSecurityPassword.confirmPasswordLabel")}
					>
						<PasswordInput
							value={confirmPassword}
							onChange={(value) => {
								setConfirmPassword(value)
								setError(undefined)
							}}
							visible={showConfirmPassword}
							onToggleVisible={() => setShowConfirmPassword((prev) => !prev)}
							placeholder={t(
								"setting.accountSecurityPassword.confirmPasswordPlaceholder",
							)}
							dataTestId="mobile-settings-password-confirm-input"
						/>
					</PasswordField>
				</>
			) : (
				<PasswordSuccessView
					headline={t("setting.accountSecurityPassword.successHeadline")}
					description={t("setting.accountSecurityPassword.successDescription")}
					doneLabel={t("setting.accountSecurityPassword.done")}
					onDone={onClose}
				/>
			)}
			{error ? (
				<div className="px-3.5 text-[13px] leading-4 text-destructive">{error}</div>
			) : null}
		</MobileSettingsSheetContainer>
	)
}

interface PasswordMethodTabsProps {
	method: MobileSettingsPasswordMethod
	hasPhone: boolean
	hasEmail: boolean
	onChange: (method: MobileSettingsPasswordMethod) => void
}

/** Inline phone/email tabs replace the former picker sheet; disabled when account lacks that channel. */
function PasswordMethodTabs({ method, hasPhone, hasEmail, onChange }: PasswordMethodTabsProps) {
	const { t } = useTranslation("interface")

	return (
		<div className="flex gap-2 px-3.5">
			<button
				type="button"
				className={cn(
					"flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
					method === "phone"
						? "border-primary bg-primary/5 text-primary"
						: "border-border bg-card text-foreground",
				)}
				disabled={!hasPhone}
				onClick={() => onChange("phone")}
				data-testid="mobile-settings-password-tab-phone"
			>
				<Smartphone className="h-4 w-4 shrink-0" />
				{t("setting.mobileVerify")}
			</button>
			<button
				type="button"
				className={cn(
					"flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
					method === "email"
						? "border-primary bg-primary/5 text-primary"
						: "border-border bg-card text-foreground",
				)}
				disabled={!hasEmail}
				onClick={() => onChange("email")}
				data-testid="mobile-settings-password-tab-email"
			>
				<Mail className="h-4 w-4 shrink-0" />
				{t("setting.emailVerify")}
			</button>
		</div>
	)
}

/** Read-only phone/email row with inline send-code action on the right. */
function PasswordReadonlyTarget(props: {
	method: MobileSettingsPasswordMethod
	currentPhone?: string
	currentEmail?: string
	countryCode: string
	sendCodeButton: React.ReactNode
}) {
	const { t } = useTranslation("interface")
	const { method, currentPhone, currentEmail, countryCode, sendCodeButton } = props
	const Icon = method === "phone" ? Smartphone : Mail
	const label = method === "phone" ? t("setting.phoneNumber") : t("setting.email")
	const value =
		method === "phone" && currentPhone
			? encryptPhoneWithCountryCode(currentPhone, countryCode)
			: currentEmail || t("setting.notBind")

	return (
		<PasswordField label={label}>
			<div className="flex items-stretch gap-2 px-3.5">
				<div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-lg bg-card px-3.5">
					<Icon className="h-5 w-5 shrink-0 text-foreground" />
					<span className="truncate text-base leading-5 text-muted-foreground">
						{value}
					</span>
				</div>
				{sendCodeButton}
			</div>
		</PasswordField>
	)
}

/** Shared label + content wrapper for password form blocks. */
function PasswordField(props: { label: string; children: React.ReactNode }) {
	const { label, children } = props

	return (
		<div className="flex flex-col gap-2">
			<div className="px-3.5 text-sm leading-5 text-muted-foreground">{label}</div>
			{children}
		</div>
	)
}

/** Password input with visibility toggle for consistent mobile styling. */
function PasswordInput(props: {
	value: string
	onChange: (value: string) => void
	visible: boolean
	onToggleVisible: () => void
	placeholder: string
	dataTestId: string
}) {
	const { value, onChange, visible, onToggleVisible, placeholder, dataTestId } = props
	const Icon = visible ? EyeOff : Eye

	return (
		<div className="relative px-3.5">
			<Input
				type={visible ? "text" : "password"}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				className="h-12 rounded-lg border-0 bg-card pr-12 text-base shadow-none"
				data-testid={dataTestId}
			/>
			<button
				type="button"
				className="absolute inset-y-0 right-3.5 flex w-12 items-center justify-center text-muted-foreground"
				onClick={onToggleVisible}
				data-testid={`${dataTestId}-visibility`}
			>
				<Icon className="h-5 w-5" />
			</button>
		</div>
	)
}

/** Success state; parent also auto-closes after a short delay. */
function PasswordSuccessView(props: {
	headline: string
	description: string
	doneLabel: string
	onDone: () => void
}) {
	const { headline, description, doneLabel, onDone } = props

	return (
		<div
			className="flex flex-col items-center gap-3 px-3.5 pb-2 pt-4 text-center"
			data-testid="mobile-settings-password-success"
		>
			<div
				className="flex h-16 w-16 items-center justify-center rounded-full bg-primary"
				aria-hidden
			>
				<Check className="h-8 w-8 text-primary-foreground" strokeWidth={3} />
			</div>
			<div className="text-lg font-semibold leading-6 text-foreground">{headline}</div>
			<div className="text-[15px] leading-5 text-muted-foreground">{description}</div>
			<button
				type="button"
				onClick={onDone}
				className="mt-2 h-12 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground transition-opacity active:opacity-90"
				data-testid="mobile-settings-password-success-done"
			>
				{doneLabel}
			</button>
		</div>
	)
}

/** Run all client-side checks before changePassword; returns user-facing error or undefined. */
function resolveSubmitValidationError(
	t: (key: string, options?: Record<string, unknown>) => string,
	code: string,
	password: string,
	confirmPassword: string,
	hasSentCode: boolean,
) {
	if (!hasSentCode) {
		return t("setting.accountSecurityPassword.codeRequired")
	}

	if (!code) {
		return resolveToString(t("form.required"), {
			label: t("setting.VerificationCode"),
		})
	}

	if (code.length !== VERIFICATION_CODE_LENGTH) {
		return t("setting.accountSecurityPassword.codeRequired")
	}

	if (password.length < MIN_PASSWORD_LENGTH) {
		return t("setting.accountSecurityPassword.weakPassword", { min: MIN_PASSWORD_LENGTH })
	}

	if (password !== confirmPassword) {
		return t("setting.accountSecurityPassword.passwordMismatch")
	}

	return undefined
}
