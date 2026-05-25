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

type PhoneSecurityView = "form" | "success"

const VERIFICATION_CODE_LENGTH = 6
const SUCCESS_AUTO_CLOSE_MS = 1500

/** Compact send-code control beside phone rows; dark fill matches header confirm affordance. */
const INLINE_SEND_CODE_BUTTON_CLASS =
	"h-12 shrink-0 rounded-lg border-0 !bg-foreground px-3 text-sm font-medium !text-background shadow-none hover:!bg-foreground/90 active:opacity-80 disabled:!bg-foreground/40 disabled:!text-background/70"

/**
 * Mobile phone change sheet: single-page collect + one-shot submit via PUT /v4/users/phone.
 * Earlier multi-step UI was prototype-only; backend has no per-step verification session.
 */
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
	const [view, setView] = useState<PhoneSecurityView>("form")
	const [hasSentCurrentCode, setHasSentCurrentCode] = useState(false)
	const [hasSentNewPhoneCode, setHasSentNewPhoneCode] = useState(false)
	const [errors, setErrors] = useState<PhoneSecurityErrors>({})
	const isChangeMode = Boolean(currentPhone)

	/** Auto-close success view after brief feedback, matching other account-security sheets. */
	useEffect(() => {
		if (view !== "success") return

		const timer = window.setTimeout(() => {
			onClose()
		}, SUCCESS_AUTO_CLOSE_MS)

		return () => window.clearTimeout(timer)
	}, [onClose, view])

	/** Reset all fields when the sheet opens so prior attempts do not leak into a new session. */
	useEffect(() => {
		if (!open) return

		setPhoneStateCode(defaultCountryCode)
		setCurrentCode("")
		setNewPhone("")
		setNewPhoneCode("")
		setView("form")
		setHasSentCurrentCode(false)
		setHasSentNewPhoneCode(false)
		setErrors({})
	}, [defaultCountryCode, open])

	/** Validate the full change-phone form before calling the one-shot changePhone API. */
	const validateChangePhoneForm = useMemoizedFn(() => {
		const nextErrors: PhoneSecurityErrors = {}

		if (!currentCode) {
			nextErrors.currentCode = resolveToString(t("form.required"), {
				label: t("setting.VerificationCode"),
			})
		} else if (currentCode.length !== VERIFICATION_CODE_LENGTH) {
			nextErrors.currentCode = t("setting.accountSecurityPhone.codeInvalid")
		}

		if (!newPhone) {
			nextErrors.newPhone = resolveToString(t("form.required"), {
				label: t("setting.newPhone"),
			})
		} else if (!validatePhone(newPhone, phoneStateCode)) {
			nextErrors.newPhone = t("setting.invalidPhone")
		} else if (newPhone === currentPhone && phoneStateCode === defaultCountryCode) {
			nextErrors.newPhone = t("setting.samePhone")
		}

		if (!newPhoneCode) {
			nextErrors.newPhoneCode = resolveToString(t("form.required"), {
				label: t("setting.newPhoneCode"),
			})
		} else if (newPhoneCode.length !== VERIFICATION_CODE_LENGTH) {
			nextErrors.newPhoneCode = t("setting.accountSecurityPhone.codeInvalid")
		}

		setErrors(nextErrors)
		return Object.keys(nextErrors).length === 0
	})

	/** Header confirm: submit current + new codes and new phone in one request. */
	const handleChangePhone = useMemoizedFn(async () => {
		if (isSaving) return
		if (!isChangeMode) {
			// TODO(mobile-refactor-cleanup): No bind-phone API for logged-in users in this repo yet.
			return
		}
		if (!validateChangePhoneForm()) return

		try {
			setIsSaving(true)
			await UserApi.changePhone(currentCode, newPhone, newPhoneCode, phoneStateCode)
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

	/** Send verification code to the currently bound phone number. */
	const handleSendCurrentCode = useMemoizedFn(
		async (codeType: VerificationCode, phone: string) => {
			await service
				.get<LoginService>("loginService")
				.getUsersVerificationCode(codeType, phone)
			setHasSentCurrentCode(true)
		},
	)

	/** Send verification code to the new phone; stays on the same page (no step transition). */
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

		await service
			.get<LoginService>("loginService")
			.getPhoneVerificationCode(VerificationCode.BindPhone, newPhone, phoneStateCode)
		setNewPhoneCode("")
		setHasSentNewPhoneCode(true)
		setErrors((prev) => ({ ...prev, newPhone: undefined, newPhoneCode: undefined }))
	})

	const maskedPhone = currentPhone
		? formatMaskedPhone(currentPhone, defaultCountryCode)
		: t("setting.notBind")
	const formattedNewPhone = formatNewPhoneForDisplay(newPhone, phoneStateCode)

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={
				view === "success"
					? t("setting.accountSecurityPhone.successTitle")
					: t("setting.accountSecurityPhone.changeTitle")
			}
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
			onCloseClick={onClose}
			onConfirm={view === "form" ? handleChangePhone : undefined}
			confirmAriaLabel={t("button.save")}
			confirmDisabled={isSaving}
			hideCloseButton={view === "success"}
			contentClassName="gap-3 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-2"
			dataTestId="mobile-settings-phone-security-sheet"
		>
			{view === "form" ? (
				<PhoneChangeFormView
					description={t("setting.accountSecurityPhone.changeDescription")}
					currentPhoneLabel={t("setting.accountSecurityPhone.currentPhone")}
					currentCodeLabel={t("setting.VerificationCode")}
					newPhoneCodeLabel={t("setting.newPhoneCode")}
					maskedPhone={maskedPhone}
					currentCode={currentCode}
					currentCodeError={errors.currentCode}
					hasSentCurrentCode={hasSentCurrentCode}
					currentPhone={currentPhone}
					phoneStateCode={phoneStateCode}
					newPhone={newPhone}
					newPhoneCode={newPhoneCode}
					newPhoneError={errors.newPhone}
					newPhoneCodeError={errors.newPhoneCode}
					hasSentNewPhoneCode={hasSentNewPhoneCode}
					isSaving={isSaving}
					onCurrentCodeChange={(value) => {
						setCurrentCode(value)
						setErrors((prev) => ({ ...prev, currentCode: undefined }))
					}}
					onSendCurrentCode={handleSendCurrentCode}
					onCountryCodeChange={setPhoneStateCode}
					onNewPhoneChange={(value) => {
						setNewPhone(value)
						setErrors((prev) => ({ ...prev, newPhone: undefined }))
					}}
					onNewPhoneCodeChange={(value) => {
						setNewPhoneCode(value)
						setErrors((prev) => ({ ...prev, newPhoneCode: undefined }))
					}}
					onSendNewPhoneCode={handleSendNewPhoneCode}
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

interface PhoneChangeFormViewProps {
	description: string
	currentPhoneLabel: string
	currentCodeLabel: string
	newPhoneCodeLabel: string
	maskedPhone: string
	currentCode: string
	currentCodeError?: string
	hasSentCurrentCode: boolean
	currentPhone: string
	phoneStateCode: string
	newPhone: string
	newPhoneCode: string
	newPhoneError?: string
	newPhoneCodeError?: string
	hasSentNewPhoneCode: boolean
	isSaving: boolean
	onCurrentCodeChange: (value: string) => void
	onSendCurrentCode: (
		codeType: VerificationCode,
		phone: string,
		stateCode?: string,
		token?: string,
	) => Promise<void>
	onCountryCodeChange: (value: string) => void
	onNewPhoneChange: (value: string) => void
	onNewPhoneCodeChange: (value: string) => void
	onSendNewPhoneCode: () => Promise<void>
}

/** Single-page change-phone form: current verification, new number, and new-number code on one screen. */
function PhoneChangeFormView({
	description,
	currentPhoneLabel,
	currentCodeLabel,
	newPhoneCodeLabel,
	maskedPhone,
	currentCode,
	currentCodeError,
	hasSentCurrentCode,
	currentPhone,
	phoneStateCode,
	newPhone,
	newPhoneCode,
	newPhoneError,
	newPhoneCodeError,
	hasSentNewPhoneCode,
	isSaving,
	onCurrentCodeChange,
	onSendCurrentCode,
	onCountryCodeChange,
	onNewPhoneChange,
	onNewPhoneCodeChange,
	onSendNewPhoneCode,
}: PhoneChangeFormViewProps) {
	const { t } = useTranslation("interface")

	return (
		<>
			<p className="px-3.5 pt-1 text-[15px] leading-5 text-muted-foreground">{description}</p>

			<div className="flex flex-col gap-2">
				<PhoneSecurityLabel>{currentPhoneLabel}</PhoneSecurityLabel>
				<div className="flex items-stretch gap-2">
					<div
						className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-lg bg-card px-3.5"
						data-testid="mobile-settings-phone-current-phone-row"
					>
						<Smartphone className="h-5 w-5 shrink-0 text-foreground" />
						<span className="truncate text-base tabular-nums leading-5 text-foreground">
							{maskedPhone}
						</span>
					</div>
					<VerificationCodeButton
						type="default"
						className={INLINE_SEND_CODE_BUTTON_CLASS}
						phone={currentPhone}
						codeType={VerificationCode.ChangePhone}
						trigger={onSendCurrentCode}
						disabled={isSaving}
						data-testid="mobile-settings-phone-send-current-code-button"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<PhoneSecurityLabel>{currentCodeLabel}</PhoneSecurityLabel>
				<VerificationCodeInput
					value={currentCode}
					onChange={onCurrentCodeChange}
					disabled={!hasSentCurrentCode || isSaving}
					showError={!!currentCodeError}
					autoFocus={false}
					containerClassName="w-full justify-between gap-2"
					slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
				/>
				{currentCodeError ? (
					<div className="px-3.5 text-xs leading-4 text-destructive">
						{currentCodeError}
					</div>
				) : null}
			</div>

			<PhoneSecurityField
				label={t("setting.newPhone")}
				error={newPhoneError}
				dataTestId="mobile-settings-phone-new-phone"
			>
				<div className="flex items-stretch gap-2">
					<div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-lg bg-card px-3.5">
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
							disabled={isSaving}
							className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
							data-testid="mobile-settings-phone-new-phone-input"
						/>
					</div>
					<VerificationCodeButton
						type="default"
						className={INLINE_SEND_CODE_BUTTON_CLASS}
						phone={newPhone}
						stateCode={phoneStateCode}
						codeType={VerificationCode.BindPhone}
						trigger={async () => {
							await onSendNewPhoneCode()
						}}
						disabled={isSaving}
						data-testid="mobile-settings-phone-send-new-code-button"
					/>
				</div>
			</PhoneSecurityField>

			<div className="flex flex-col gap-2">
				<PhoneSecurityLabel>{newPhoneCodeLabel}</PhoneSecurityLabel>
				<VerificationCodeInput
					value={newPhoneCode}
					onChange={onNewPhoneCodeChange}
					disabled={!hasSentNewPhoneCode || isSaving}
					showError={!!newPhoneCodeError}
					autoFocus={false}
					containerClassName="w-full justify-between gap-2"
					slotClassName="h-[54px] w-[52px] rounded-lg border border-border bg-card text-xl shadow-none first:rounded-lg last:rounded-lg"
				/>
				{newPhoneCodeError ? (
					<div className="px-3.5 text-xs leading-4 text-destructive">
						{newPhoneCodeError}
					</div>
				) : null}
			</div>
		</>
	)
}

/** Success state with explicit feedback; parent also auto-closes after a short delay. */
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

/** Wraps a labeled field block with optional error text and a stable test id. */
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

/** Field title styling aligned with mobile account-security prototypes. */
function PhoneSecurityLabel({ children }: { children: React.ReactNode }) {
	return <div className="px-3.5 text-sm leading-5 text-muted-foreground">{children}</div>
}

/** Mask display only; submit payload still uses raw phone and country code. */
function formatMaskedPhone(phone: string, countryCode: string) {
	const encryptedPhone = encryptPhoneWithCountryCode(phone, countryCode)
	const match = encryptedPhone.match(/^(\+\d+)\s*(\d{3})(\*+)(\d{4})$/)
	if (!match) return encryptedPhone

	return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`
}

/** Display helper for success copy; does not affect API fields. */
function formatNewPhoneForDisplay(phone: string, countryCode: string) {
	if (!phone) return countryCode
	return `${countryCode} ${phone}`
}
