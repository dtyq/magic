import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"

import { useId } from "react"
import type { HTMLAttributes, MouseEvent } from "react"
import { PrivacyPolicyUrl, ServiceAgreementUrl } from "../../constants"

interface AgreePolicyCheckboxProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
	showCheckbox?: boolean
	agree?: boolean
	onChange?: (agree: boolean) => void
}

function AgreePolicyCheckbox({
	agree,
	showCheckbox = false,
	onChange,
	className,
	...props
}: AgreePolicyCheckboxProps) {
	const { t } = useTranslation("login")
	const checkboxId = useId()

	function handleLinkClick(event: MouseEvent<HTMLAnchorElement>) {
		event.stopPropagation()
	}

	const dom = (
		<div className="flex w-full flex-wrap items-center justify-center gap-0 text-center">
			<span className={textClassName}>{t("readAndAgree")}</span>
			<a
				href={ServiceAgreementUrl}
				target="_blank"
				className={linkClassName}
				rel="noreferrer"
				onClick={handleLinkClick}
				data-testid="service-agreement-link"
			>
				{t("serviceAgreement")}
			</a>
			<span className={textClassName}>{t("and")}</span>
			<a
				href={PrivacyPolicyUrl}
				target="_blank"
				className={linkClassName}
				rel="noreferrer"
				onClick={handleLinkClick}
				data-testid="privacy-policy-link"
			>
				{t("privacyPolicy")}
			</a>
		</div>
	)

	return (
		<div
			{...props}
			className={cn(
				"flex items-start gap-2 whitespace-nowrap max-[700px]:whitespace-normal",
				className,
			)}
			data-testid="agree-policy-container"
		>
			{showCheckbox ? (
				<label htmlFor={checkboxId} className="flex cursor-pointer gap-2">
					<Checkbox
						id={checkboxId}
						checked={agree}
						onCheckedChange={(checked) => onChange?.(checked === true)}
						data-testid="agree-policy-checkbox"
						className="mt-0"
					/>
					{dom}
				</label>
			) : (
				dom
			)}
		</div>
	)
}

export default AgreePolicyCheckbox

const textClassName = "text-sm font-normal leading-4 text-foreground/80"
const linkClassName = cn(
	textClassName,
	"mx-2 underline underline-offset-[3px] hover:text-foreground/80",
)
