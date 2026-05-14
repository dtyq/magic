import { useEffect, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { resolveToString } from "@dtyq/es6-template-strings"
import { mutate } from "swr"
import { toast } from "sonner"
import { Check, Smartphone } from "lucide-react"
import { useTranslation } from "react-i18next"

import { UserApi } from "@/apis"
import VerificationCodeButton from "@/components/business/VerificationCodeButton"
import VerificationCodeInput from "@/components/business/VerificationCodeInput"
import { Input } from "@/components/shadcn-ui/input"
import PhoneStateCodeSelect from "@/components/other/PhoneStateCodeSelect"
import { VerificationCode } from "@/constants/bussiness"
import { service } from "@/services"
import type { LoginService } from "@/services/user/LoginService"
import { encryptPhoneWithCountryCode, validatePhone } from "@/utils/phone"

import { MobileSettingsSheetContainer } from "./SheetContainer"

interface MobileSettingsPhoneSecuritySheetProps {
	open: boolean
	onClose: () => void
	currentPhone?: string
	defaultCountryCode?: string
}

interface PhoneSecurityErrors {
	currentCode?: string
	newPhone?: string
	newPhoneCode?: string
}

type PhoneSecurityView = "verifyCurrent" | "inputNew" | "verifyNew" | "success"

const VERIFICATION_CODE_LENGTH = 6
const SUCCESS_AUTO_CLOSE_MS = 1500

/** 手机号安全浮层复用现有换绑 API，把设置页里的视觉还原与业务提交解耦。 */
export function MobileSettingsPhoneSecuritySheet({
	open,
	onClose,
	currentPhone = "",
	defaultCountryCode = "+86",
}: MobileSettingsPhoneSecuritySheetProps) {
	const { t } = useTranslation("interface")
	const [phoneStateCode, setPhoneStateCode] = useState(defaultCountryCode)
	const [currentCode, setCurrentCode] = useState("")
	const [newPhone, setNewPhone] = useState("")
	const [newPhoneCode, setNewPhoneCode] = useState("")
	const [isSaving, setIsSaving] = useState(false)
	const [view, setView] = useState<PhoneSecurityView>("verifyCurrent")
	const [hasSentCurrentCode, setHasSentCurrentCode] = useState(false)
	const [hasSentNewPhoneCode, setHasSentNewPhoneCode] = useState(false)
	const [errors, setErrors] = useState<PhoneSecurityErrors>({})
	const isChangeMode = Boolean(currentPhone)

	/** 成功态短暂停留后关闭，让用户看见换绑完成反馈。 */
	useEffect(() => {
		if (view !== "success") return

		const timer = window.setTimeout(() => {
			onClose()
		}, SUCCESS_AUTO_CLOSE_MS)

		return () => window.clearTimeout(timer)
	}, [onClose, view])

	/** 每次打开或默认区号变化时重置表单，避免上一次输入泄漏到新的账号状态。 */
	useEffect(() => {
		if (!open) return

		setPhoneStateCode(defaultCountryCode)
		setCurrentCode("")
		setNewPhone("")
		setNewPhoneCode("")
		setView("verifyCurrent")
		setHasSentCurrentCode(false)
		setHasSentNewPhoneCode(false)
		setErrors({})
	}, [defaultCountryCode, isChangeMode, open])

	/** 当前手机号验证码输满后先走临时直通边界，后续可在同一位置接入独立校验 API。 */
	const handleCurrentCodeComplete = useMemoizedFn(async (value: string) => {
		setCurrentCode(value)
		setErrors((prev) => ({ ...prev, currentCode: undefined }))
		const canContinue = await canContinueAfterCurrentPhoneCode(value)
		if (canContinue) setView("inputNew")
	})

	/** 包装发送当前手机号验证码的真实服务，并记录输入框可用状态。 */
	const handleSendCurrentCode = useMemoizedFn(
		async (codeType: VerificationCode, phone: string) => {
			await service
				.get<LoginService>("loginService")
				.getUsersVerificationCode(codeType, phone)
			setHasSentCurrentCode(true)
		},
	)

	/** 原型第二步右上角确认会发送新手机号验证码并进入 6 位验证码页。 */
	const handleSendNewPhoneCode = useMemoizedFn(async () => {
		const nextErrors: PhoneSecurityErrors = {}

		if (!newPhone) {
			nextErrors.newPhone = resolveToString(t("form.required"), {
				label: t("setting.newPhone"),
			})
		} else if (!validatePhone(newPhone, phoneStateCode)) {
			nextErrors.newPhone = t("setting.invalidPhone")
		} else if (newPhone === currentPhone && phoneStateCode === defaultCountryCode) {
			nextErrors.newPhone = t("setting.samePhone")
		}

		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0) return

		// 新手机号输入页只负责发起验证码发送；验证码内容会在下一层输入并最终提交。
		await service
			.get<LoginService>("loginService")
			.getPhoneVerificationCode(VerificationCode.BindPhone, newPhone, phoneStateCode)
		setNewPhoneCode("")
		setHasSentNewPhoneCode(true)
		setView("verifyNew")
	})

	/** 新手机号验证码输满后沿用现有换绑接口一次性提交两段验证码。 */
	const handleSubmitNewPhoneCode = useMemoizedFn(async (value: string) => {
		if (isSaving) return
		if (!isChangeMode) {
			// TODO(mobile-refactor-cleanup): 当前仓库未发现“已登录账号绑定手机号”的独立 API。
			return
		}
		if (!currentCode) return
		const canSubmit = await canSubmitAfterNewPhoneCode(value)
		if (!canSubmit) return

		try {
			setIsSaving(true)
			await UserApi.changePhone(currentCode, newPhone, value, phoneStateCode)
			await mutate("/v4/users/info")
			toast.success(t("setting.changePhoneSuccess", { ns: "message" }))
			setView("success")
		} catch (error) {
			console.error("Failed to change phone:", error)
			setErrors((prev) => ({
				...prev,
				newPhoneCode: t("setting.accountSecurityPhone.codeInvalid"),
			}))
			toast.error(t("setting.changePhoneFailed", { ns: "message" }))
		} finally {
			setIsSaving(false)
		}
	})

	function handleNewPhoneCodeChange(value: string) {
		setNewPhoneCode(value)
		setErrors((prev) => ({ ...prev, newPhoneCode: undefined }))
	}

	/** 新手机号验证码页左侧按钮返回输入页，符合原型中的分层返回路径。 */
	function handleHeaderClose() {
		if (view === "verifyNew") {
			setView("inputNew")
			setNewPhoneCode("")
			setErrors((prev) => ({ ...prev, newPhoneCode: undefined }))
			return
		}

		onClose()
	}

	const title = getPhoneSecurityTitle(t, view)
	const maskedPhone = currentPhone
		? formatMaskedPhone(currentPhone, defaultCountryCode)
		: t("setting.notBind")
	const formattedNewPhone = formatNewPhoneForDisplay(newPhone, phoneStateCode)

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={title}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			onCloseClick={handleHeaderClose}
			onConfirm={view === "inputNew" ? handleSendNewPhoneCode : undefined}
			confirmAriaLabel={t("button.confirm")}
			// 确认按钮保持可点，由提交校验展示必填、格式错误或重复手机号，避免用户点击后无反馈。
			confirmDisabled={false}
			hideCloseButton={view === "success"}
			contentClassName="gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-phone-security-sheet"
		>
			{view === "verifyCurrent" ? (
				<CurrentPhoneVerifyView
					description={t("setting.accountSecurityPhone.changeDescription")}
					currentPhoneLabel={t("setting.accountSecurityPhone.currentPhone")}
					codeLabel={t("setting.VerificationCode")}
					maskedPhone={maskedPhone}
					code={currentCode}
					codeError={errors.currentCode}
					hasSentCode={hasSentCurrentCode}
					currentPhone={currentPhone}
					onCodeChange={(value) => {
						setCurrentCode(value)
						setErrors((prev) => ({ ...prev, currentCode: undefined }))
					}}
					onCodeComplete={handleCurrentCodeComplete}
					onSendCode={handleSendCurrentCode}
				/>
			) : view === "inputNew" ? (
				<NewPhoneInputView
					description={t("setting.accountSecurityPhone.newPhoneDescription")}
					phoneStateCode={phoneStateCode}
					newPhone={newPhone}
					errors={errors}
					onCountryCodeChange={setPhoneStateCode}
					onNewPhoneChange={(value) => {
						setNewPhone(value)
						setErrors((prev) => ({ ...prev, newPhone: undefined }))
					}}
					onSubmit={handleSendNewPhoneCode}
				/>
			) : view === "verifyNew" ? (
				<NewPhoneCodeView
					codeHint={t("setting.accountSecurityPhone.codeHint")}
					phoneDisplay={formattedNewPhone}
					code={newPhoneCode}
					codeError={errors.newPhoneCode}
					hasSentCode={hasSentNewPhoneCode}
					isSaving={isSaving}
					newPhone={newPhone}
					phoneStateCode={phoneStateCode}
					onCodeChange={handleNewPhoneCodeChange}
					onCodeComplete={handleSubmitNewPhoneCode}
					onResendCode={async (codeType, phone, stateCode, token) => {
						await service
							.get<LoginService>("loginService")
							.getPhoneVerificationCode(codeType, phone, stateCode, token)
						setHasSentNewPhoneCode(true)
						setErrors((prev) => ({ ...prev, newPhoneCode: undefined }))
					}}
				/>
			) : (
				<PhoneSuccessView
					headline={t("setting.accountSecurityPhone.successHeadline")}
					description={t("setting.accountSecurityPhone.successDescription", {
						phone: formattedNewPhone,
					})}
					doneLabel={t("setting.accountSecurityPhone.done")}
					onDone={onClose}
				/>
			)}
		</MobileSettingsSheetContainer>
	)
}

/** 根据当前手机号换绑步骤切换标题，避免主渲染中堆叠条件表达式。 */
function getPhoneSecurityTitle(
	t: (key: string, options?: Record<string, unknown>) => string,
	view: PhoneSecurityView,
) {
	if (view === "verifyCurrent") return t("setting.changePhone")
	if (view === "inputNew") return t("setting.accountSecurityPhone.inputTitle")
	if (view === "verifyNew") return t("setting.accountSecurityPhone.codeTitle")
	return t("setting.accountSecurityPhone.successTitle")
}

interface CurrentPhoneVerifyViewProps {
	description: string
	currentPhoneLabel: string
	codeLabel: string
	maskedPhone: string
	code: string
	codeError?: string
	hasSentCode: boolean
	currentPhone: string
	onCodeChange: (value: string) => void
	onCodeComplete: (value: string) => void
	onSendCode: (
		codeType: VerificationCode,
		phone: string,
		stateCode?: string,
		token?: string,
	) => Promise<void>
}

/** 当前手机号验证视图按原型拆成说明、只读手机号、整行发送按钮和 6 位验证码输入。 */
function CurrentPhoneVerifyView({
	description,
	currentPhoneLabel,
	codeLabel,
	maskedPhone,
	code,
	codeError,
	hasSentCode,
	currentPhone,
	onCodeChange,
	onCodeComplete,
	onSendCode,
}: CurrentPhoneVerifyViewProps) {
	return (
		<>
			<p className="px-3.5 pt-1 text-[15px] leading-5 text-muted-foreground">{description}</p>

			<div className="flex flex-col gap-2">
				<PhoneSecurityLabel>{currentPhoneLabel}</PhoneSecurityLabel>
				<div
					className="flex h-12 items-center gap-3 rounded-lg bg-card px-3.5"
					data-testid="mobile-settings-phone-current-phone-row"
				>
					<Smartphone className="h-5 w-5 shrink-0 text-foreground" />
					<span className="truncate text-base tabular-nums leading-5 text-foreground">
						{maskedPhone}
					</span>
				</div>
			</div>

			<VerificationCodeButton
				className="mt-1 h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
				phone={currentPhone}
				codeType={VerificationCode.ChangePhone}
				trigger={onSendCode}
				data-testid="mobile-settings-phone-send-current-code-button"
			/>

			<div className="flex flex-col gap-2">
				<PhoneSecurityLabel>{codeLabel}</PhoneSecurityLabel>
				<VerificationCodeInput
					value={code}
					onChange={onCodeChange}
					onInputComplete={onCodeComplete}
					disabled={!hasSentCode}
					showError={!!codeError}
					autoFocus={false}
					containerClassName="w-full justify-between gap-2"
					slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
				/>
				{codeError ? (
					<div className="px-3.5 text-xs leading-4 text-destructive">{codeError}</div>
				) : null}
			</div>
		</>
	)
}

interface NewPhoneInputViewProps {
	description: string
	phoneStateCode: string
	newPhone: string
	errors: PhoneSecurityErrors
	onCountryCodeChange: (value: string) => void
	onNewPhoneChange: (value: string) => void
	onSubmit: () => void
}

/** 新手机号输入页只负责收集号码；右上角确认会发送验证码并进入下一层。 */
function NewPhoneInputView({
	description,
	phoneStateCode,
	newPhone,
	errors,
	onCountryCodeChange,
	onNewPhoneChange,
	onSubmit,
}: NewPhoneInputViewProps) {
	const { t } = useTranslation("interface")

	return (
		<>
			<p className="px-3.5 pt-1 text-[15px] leading-5 text-muted-foreground">{description}</p>

			<PhoneSecurityField
				label={t("setting.newPhone")}
				error={errors.newPhone}
				dataTestId="mobile-settings-phone-new-phone"
			>
				<div className="flex h-12 items-center gap-2 rounded-lg bg-card px-3.5">
					<PhoneStateCodeSelect
						value={phoneStateCode}
						onChange={onCountryCodeChange}
						className="h-8 border-0 bg-transparent shadow-none"
						dataTestId="mobile-settings-phone-country-code-select"
					/>
					<div className="h-5 w-px bg-border" aria-hidden />
					<Input
						value={newPhone}
						onChange={(event) => onNewPhoneChange(event.target.value)}
						inputMode="tel"
						placeholder={t("setting.phoneNumberPlaceholder")}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault()
								onSubmit()
							}
						}}
						className="h-10 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
						data-testid="mobile-settings-phone-new-phone-input"
					/>
				</div>
			</PhoneSecurityField>
		</>
	)
}

interface NewPhoneCodeViewProps {
	codeHint: string
	phoneDisplay: string
	code: string
	codeError?: string
	hasSentCode: boolean
	isSaving: boolean
	newPhone: string
	phoneStateCode: string
	onCodeChange: (value: string) => void
	onCodeComplete: (value: string) => void
	onResendCode: (
		codeType: VerificationCode,
		phone: string,
		stateCode?: string,
		token?: string,
	) => Promise<void>
}

/** 新手机号验证码页严格使用原型的 6 位格子，输满后提交真实换绑接口。 */
function NewPhoneCodeView({
	codeHint,
	phoneDisplay,
	code,
	codeError,
	hasSentCode,
	isSaving,
	newPhone,
	phoneStateCode,
	onCodeChange,
	onCodeComplete,
	onResendCode,
}: NewPhoneCodeViewProps) {
	return (
		<>
			<div className="space-y-1 px-3.5 pt-1">
				<p className="text-[15px] leading-5 text-muted-foreground">{codeHint}</p>
				<p className="text-xl font-semibold leading-7 text-foreground">{phoneDisplay}</p>
			</div>

			<div className="flex flex-col gap-2 px-3.5 pt-1">
				<VerificationCodeInput
					value={code}
					onChange={onCodeChange}
					onInputComplete={onCodeComplete}
					disabled={!hasSentCode || isSaving}
					showError={!!codeError}
					autoFocus
					containerClassName="w-full justify-between gap-2"
					slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
				/>
				{codeError ? (
					<div className="text-[13px] leading-4 text-destructive">{codeError}</div>
				) : null}
			</div>

			<div className="flex justify-center pt-2">
				<VerificationCodeButton
					type="link"
					className="h-auto bg-transparent px-0 text-sm font-medium text-primary shadow-none hover:bg-transparent"
					phone={newPhone}
					stateCode={phoneStateCode}
					codeType={VerificationCode.BindPhone}
					trigger={onResendCode}
					disabled={isSaving}
					data-testid="mobile-settings-phone-resend-new-code-button"
				/>
			</div>
		</>
	)
}

/** 换绑成功页提供明确结果反馈，并在短暂停留后自动关闭。 */
function PhoneSuccessView(props: {
	headline: string
	description: string
	doneLabel: string
	onDone: () => void
}) {
	const { headline, description, doneLabel, onDone } = props

	return (
		<div
			className="flex flex-col items-center gap-3 px-3.5 pb-2 pt-4 text-center"
			data-testid="mobile-settings-phone-success"
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
				data-testid="mobile-settings-phone-success-done"
			>
				{doneLabel}
			</button>
		</div>
	)
}

/** 表单字段统一收口标签、错误文案和测试选择器，避免每个输入块各写一套结构。 */
function PhoneSecurityField(props: {
	label: string
	error?: string
	children: React.ReactNode
	dataTestId: string
}) {
	const { label, error, children, dataTestId } = props

	return (
		<div className="flex flex-col gap-2" data-testid={dataTestId}>
			<div className="px-3.5 text-sm leading-5 text-muted-foreground">{label}</div>
			{children}
			{error ? (
				<div className="px-3.5 text-xs leading-4 text-destructive">{error}</div>
			) : null}
		</div>
	)
}

/** 字段标题使用与原型一致的内缩和弱文本颜色，保证各块视觉节奏统一。 */
function PhoneSecurityLabel({ children }: { children: React.ReactNode }) {
	return <div className="px-3.5 text-sm leading-5 text-muted-foreground">{children}</div>
}

/** 当前手机号验证码暂时只做长度门禁；后续独立校验 API 到位后在这里替换为真实校验。 */
async function canContinueAfterCurrentPhoneCode(value: string) {
	if (value.length !== VERIFICATION_CODE_LENGTH) return false

	// TODO(mobile-refactor-cleanup): 接入当前手机号验证码独立校验 API 后，失败时返回 false 并展示错误文案。
	return true
}

/** 新手机号验证码暂时交给最终换绑接口校验；这里保留未来独立校验 API 的异步接入点。 */
async function canSubmitAfterNewPhoneCode(value: string) {
	if (value.length !== VERIFICATION_CODE_LENGTH) return false

	// TODO(mobile-refactor-cleanup): 接入新手机号验证码独立校验 API 后，再决定是否继续调用 changePhone。
	return true
}

/** 原型手机号脱敏包含空格分组，这里只改展示格式，不改变后端提交值。 */
function formatMaskedPhone(phone: string, countryCode: string) {
	const encryptedPhone = encryptPhoneWithCountryCode(phone, countryCode)
	const match = encryptedPhone.match(/^(\+\d+)\s*(\d{3})(\*+)(\d{4})$/)
	if (!match) return encryptedPhone

	return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`
}

/** 新手机号展示只影响 UI，不改变提交给后端的纯手机号与区号字段。 */
function formatNewPhoneForDisplay(phone: string, countryCode: string) {
	if (!phone) return countryCode
	return `${countryCode} ${phone}`
}
