import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { Check, ChevronRight, Eye, EyeOff, Mail, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { UserApi } from "@/apis"
import VerificationCodeButton from "@/components/business/VerificationCodeButton"
import VerificationCodeInput from "@/components/business/VerificationCodeInput"
import { Input } from "@/components/shadcn-ui/input"
import { VerificationCode } from "@/constants/bussiness"
import { encryptPhoneWithCountryCode } from "@/utils/phone"

import { MobileSettingsSheetContainer } from "./SheetContainer"

export type MobileSettingsPasswordMethod = "phone" | "email"

interface MobileSettingsPasswordPickerSheetProps {
	open: boolean
	onClose: () => void
	hasPhone: boolean
	hasEmail: boolean
	onSelect: (method: MobileSettingsPasswordMethod) => void
}

interface MobileSettingsPasswordSheetProps {
	open: boolean
	onClose: () => void
	method: MobileSettingsPasswordMethod
	currentPhone?: string
	currentEmail?: string
	countryCode?: string
}

const MIN_PASSWORD_LENGTH = 8
const SUCCESS_AUTO_CLOSE_MS = 1500

// TODO(mobile-refactor-cleanup): 原型包含“使用原密码”验证方式；当前仓库未发现
// old_password/current_password 之类契约，确认后再扩展 MobileSettingsPasswordMethod。

/** 密码修改方式选择层只展示当前账号真实可用的验证方式，避免用户进入不可完成流程。 */
export function MobileSettingsPasswordPickerSheet({
	open,
	onClose,
	hasPhone,
	hasEmail,
	onSelect,
}: MobileSettingsPasswordPickerSheetProps) {
	const { t } = useTranslation("interface")

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("setting.changeLoginPassword")}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			contentClassName="gap-2.5 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-password-picker-sheet"
		>
			<div className="px-3.5 text-[15px] leading-5 text-muted-foreground">
				{t("setting.accountSecurityPassword.pickDescription")}
			</div>
			<div className="overflow-hidden rounded-lg bg-card">
				<PasswordMethodRow
					icon={<Smartphone className="h-5 w-5" />}
					label={t("setting.mobileVerify")}
					description={
						hasPhone
							? t("setting.accountSecurityPassword.phoneVerifyDescription")
							: t("setting.accountSecurityPassword.unavailable")
					}
					disabled={!hasPhone}
					showDivider
					onClick={() => onSelect("phone")}
					dataTestId="mobile-settings-password-method-phone"
				/>
				<PasswordMethodRow
					icon={<Mail className="h-5 w-5" />}
					label={t("setting.emailVerify")}
					description={
						hasEmail
							? t("setting.accountSecurityPassword.emailVerifyDescription")
							: t("setting.accountSecurityPassword.unavailable")
					}
					disabled={!hasEmail}
					onClick={() => onSelect("email")}
					dataTestId="mobile-settings-password-method-email"
				/>
			</div>
		</MobileSettingsSheetContainer>
	)
}

/** 密码修改主流程按原型拆成验证与设置新密码两步，提交仍复用现有 changePassword API。 */
export function MobileSettingsPasswordSheet({
	open,
	onClose,
	method,
	currentPhone,
	currentEmail,
	countryCode = "+86",
}: MobileSettingsPasswordSheetProps) {
	const { t } = useTranslation("interface")
	const [view, setView] = useState<"verify" | "setNew" | "success">("verify")
	const [code, setCode] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [isSaving, setIsSaving] = useState(false)
	const [hasSentCode, setHasSentCode] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [error, setError] = useState<string>()

	const verifyTarget = method === "phone" ? currentPhone : currentEmail
	const isPasswordLongEnough = password.length >= MIN_PASSWORD_LENGTH
	const canSubmit =
		isPasswordLongEnough && confirmPassword.length > 0 && password === confirmPassword

	/** 成功态短暂停留后自动关闭，和原型的完成反馈节奏保持一致。 */
	useEffect(() => {
		if (view !== "success") return

		const timer = window.setTimeout(() => {
			onClose()
		}, SUCCESS_AUTO_CLOSE_MS)

		return () => window.clearTimeout(timer)
	}, [onClose, view])

	/** 关闭或切换验证方式时重置步骤，保证每次打开都从验证开始。 */
	useEffect(() => {
		if (!open) {
			resetState()
			return
		}

		setView("verify")
		setCode("")
		setPassword("")
		setConfirmPassword("")
		setHasSentCode(false)
		setError(undefined)
	}, [method, open])

	/** 6 位验证码输入完成后进入设置新密码；验证码真伪仍由最终接口校验。 */
	const handleVerifyCodeComplete = useMemoizedFn((value: string) => {
		setCode(value)
		setError(undefined)
		setView("setNew")
	})

	/** 包装验证码发送动作，只在发送成功后启用 OTP 输入。 */
	const handleSendCode = useMemoizedFn(async (codeType: VerificationCode, target: string) => {
		await UserApi.getUsersVerificationCode(codeType, target)
		setHasSentCode(true)
		setCode("")
		setError(undefined)
	})

	/** 使用现有密码修改接口提交验证码与新密码，保持业务逻辑单一真源。 */
	const handleSubmit = useMemoizedFn(async () => {
		if (!canSubmit || isSaving) {
			setError(resolvePasswordError(t, password, confirmPassword))
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

	function resetState() {
		setView("verify")
		setCode("")
		setPassword("")
		setConfirmPassword("")
		setIsSaving(false)
		setHasSentCode(false)
		setShowPassword(false)
		setShowConfirmPassword(false)
		setError(undefined)
	}

	/** 设置新密码页左侧按钮返回验证步骤，成功页按钮则直接关闭整个流程。 */
	function handleHeaderClose() {
		if (view === "setNew") {
			setView("verify")
			setPassword("")
			setConfirmPassword("")
			setError(undefined)
			return
		}

		onClose()
	}

	const title = getPasswordSheetTitle(t, view)
	const shouldShowConfirm = view === "setNew"

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={title}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			onCloseClick={handleHeaderClose}
			onConfirm={shouldShowConfirm ? handleSubmit : undefined}
			confirmAriaLabel={t("button.confirm")}
			confirmDisabled={!canSubmit || isSaving}
			hideCloseButton={view === "success"}
			contentClassName="gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-password-sheet"
		>
			{view === "verify" ? (
				<>
					<div className="px-3.5 text-[15px] leading-5 text-muted-foreground">
						{t("setting.accountSecurityPassword.verifyDescription")}
					</div>
					<PasswordReadonlyTarget
						method={method}
						currentPhone={currentPhone}
						currentEmail={currentEmail}
						countryCode={countryCode}
					/>
					<PasswordField label={t("setting.VerificationCode")}>
						<div className="flex flex-col gap-3">
							<VerificationCodeButton
								className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90 disabled:!bg-foreground disabled:!text-background disabled:opacity-80"
								phone={verifyTarget}
								codeType={VerificationCode.ChangePassword}
								trigger={handleSendCode}
								disabled={!verifyTarget}
								data-testid="mobile-settings-password-send-code-button"
							/>
							<VerificationCodeInput
								value={code}
								onChange={(value) => {
									setCode(value)
									setError(undefined)
								}}
								onInputComplete={handleVerifyCodeComplete}
								disabled={!hasSentCode}
								autoFocus={false}
								showError={!!error}
								containerClassName="w-full justify-between gap-2"
								slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
							/>
						</div>
					</PasswordField>
				</>
			) : view === "setNew" ? (
				<>
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

/** 按当前步骤解析 Sheet 标题，避免 JSX 中堆叠嵌套三元表达式。 */
function getPasswordSheetTitle(
	t: (key: string, options?: Record<string, unknown>) => string,
	view: "verify" | "setNew" | "success",
) {
	if (view === "verify") return t("setting.accountSecurityPassword.verifyTitle")
	if (view === "setNew") return t("setting.accountSecurityPassword.setNewTitle")
	return t("setting.accountSecurityPassword.successTitle")
}

/** 统一密码修改方式行，保持 picker 中图标、文案与禁用态一致。 */
function PasswordMethodRow(props: {
	icon: React.ReactNode
	label: string
	description: string
	disabled: boolean
	showDivider?: boolean
	onClick: () => void
	dataTestId: string
}) {
	const { icon, label, description, disabled, showDivider, onClick, dataTestId } = props

	return (
		<>
			<button
				type="button"
				className="flex w-full items-center gap-3 bg-card px-3.5 py-3 text-left transition-opacity active:opacity-60 disabled:opacity-40"
				disabled={disabled}
				onClick={onClick}
				data-testid={dataTestId}
			>
				<div className="flex h-5 w-5 shrink-0 items-center justify-center text-foreground">
					{icon}
				</div>
				<div className="min-w-0 flex-1">
					<div className="truncate text-base leading-5 text-foreground">{label}</div>
					<div className="mt-0.5 truncate text-[13px] leading-4 text-muted-foreground">
						{description}
					</div>
				</div>
				{!disabled ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : null}
			</button>
			{showDivider ? <div className="ml-[42px] h-px bg-border" aria-hidden /> : null}
		</>
	)
}

/** 只读展示当前验证目标，避免用户误以为可在密码流程中修改手机号或邮箱。 */
function PasswordReadonlyTarget(props: {
	method: MobileSettingsPasswordMethod
	currentPhone?: string
	currentEmail?: string
	countryCode: string
}) {
	const { t } = useTranslation("interface")
	const { method, currentPhone, currentEmail, countryCode } = props
	const Icon = method === "phone" ? Smartphone : Mail
	const label = method === "phone" ? t("setting.phoneNumber") : t("setting.email")
	const value =
		method === "phone" && currentPhone
			? encryptPhoneWithCountryCode(currentPhone, countryCode)
			: currentEmail || t("setting.notBind")

	return (
		<PasswordField label={label}>
			<div className="flex h-12 items-center gap-3 rounded-lg bg-card px-3.5">
				<Icon className="h-5 w-5 shrink-0 text-foreground" />
				<span className="truncate text-base leading-5 text-muted-foreground">{value}</span>
			</div>
		</PasswordField>
	)
}

/** 表单字段统一收口标签和内容块，减少密码流程中的重复布局代码。 */
function PasswordField(props: { label: string; children: React.ReactNode }) {
	const { label, children } = props

	return (
		<div className="flex flex-col gap-2">
			<div className="px-3.5 text-sm leading-5 text-muted-foreground">{label}</div>
			{children}
		</div>
	)
}

/** 新密码输入封装可见性按钮，保证两个密码字段的视觉和交互一致。 */
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
		<div className="relative">
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
				className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground"
				onClick={onToggleVisible}
				data-testid={`${dataTestId}-visibility`}
			>
				<Icon className="h-5 w-5" />
			</button>
		</div>
	)
}

/** 成功态给用户明确反馈，并提供立即完成按钮；同时父级会自动关闭。 */
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

/** 根据本地校验结果生成用户可理解的错误提示，真正的验证码错误仍由接口返回。 */
function resolvePasswordError(
	t: (key: string, options?: Record<string, unknown>) => string,
	password: string,
	confirmPassword: string,
) {
	if (password.length < MIN_PASSWORD_LENGTH) {
		return t("setting.accountSecurityPassword.weakPassword", { min: MIN_PASSWORD_LENGTH })
	}

	if (password !== confirmPassword) return t("setting.accountSecurityPassword.passwordMismatch")

	return undefined
}
