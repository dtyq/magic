import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { AlertCircle } from "lucide-react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/shadcn-ui/input-otp"
import { cn } from "@/lib/utils"

interface VerificationCodeInputProps {
	/**
	 * Length of verification code
	 */
	codeLength?: number
	/**
	 * Verification code value
	 */
	value?: string
	/**
	 * Value change callback
	 */
	onChange?: (value: string) => void
	/**
	 * Whether disabled
	 */
	disabled?: boolean
	/**
	 * Whether to auto focus
	 */
	autoFocus?: boolean
	/**
	 * Whether to show error
	 */
	showError?: boolean
	/**
	 * Input complete callback
	 */
	onInputComplete?: (value: string) => void
}

/**
 * Verification code input ref
 */
export interface VerificationCodeInputRef {
	/**
	 * Focus method
	 */
	focus: () => void
}

/**
 * Verification code input component using shadcn/ui InputOTP
 *
 * @param props - Component props
 * @param ref - Component ref
 * @returns React component
 */
const VerificationCodeInput = forwardRef<VerificationCodeInputRef, VerificationCodeInputProps>(
	function VerificationCodeInput(props, ref) {
		const {
			codeLength = 6,
			value = "",
			onChange,
			disabled = false,
			autoFocus = true,
			showError = false,
			onInputComplete,
		} = props

		const { t } = useTranslation("login")
		const inputRef = useRef<HTMLInputElement>(null)
		const [internalValue, setInternalValue] = useState(value)

		// Sync external value with internal state
		useEffect(() => {
			setInternalValue(value)
		}, [value])

		// Handle value change
		const handleChange = useMemoizedFn((newValue: string) => {
			setInternalValue(newValue)
			onChange?.(newValue)

			// Trigger complete callback when all digits are entered
			if (newValue.length === codeLength) {
				onInputComplete?.(newValue)
			}
		})

		// Focus input method
		const focusInput = useMemoizedFn(() => {
			if (!disabled && inputRef.current) {
				inputRef.current.focus()
				// Scroll to input on mobile devices
				setTimeout(() => {
					inputRef.current?.scrollIntoView({
						behavior: "smooth",
						block: "center",
					})
				}, 100)
			}
		})

		// Expose focus method via ref
		useImperativeHandle(
			ref,
			() => ({
				focus: focusInput,
			}),
			[focusInput],
		)

		return (
			<div className="flex w-full flex-col items-center justify-center gap-2">
				<InputOTP
					ref={inputRef}
					maxLength={codeLength}
					pattern={REGEXP_ONLY_DIGITS}
					value={internalValue}
					onChange={handleChange}
					disabled={disabled}
					containerClassName="gap-2"
					aria-invalid={showError}
					aria-label={t("verification.codeInput")}
					autoFocus={autoFocus}
					data-testid="verification-code-input-container"
				>
					{Array.from({ length: codeLength }).map((_, idx) => (
						<InputOTPGroup key={idx}>
							<InputOTPSlot
								index={idx}
								data-testid={`verification-code-input-${idx}`}
								className={cn(
									"h-10 w-10 text-lg font-medium",
									"sm:h-14 sm:w-12 sm:text-xl",
									"transition-all duration-200",
									showError &&
									"border-red-500 data-[active=true]:border-red-500 data-[active=true]:ring-red-500/20",
									disabled && "cursor-not-allowed opacity-50",
								)}
							/>
						</InputOTPGroup>
					))}
				</InputOTP>

				{showError && (
					<div className="mt-1 flex items-center justify-center gap-1 text-sm text-red-500">
						<AlertCircle size={16} />
						<span>{t("verification.codeInvalid")}</span>
					</div>
				)}
			</div>
		)
	},
)

export default VerificationCodeInput
