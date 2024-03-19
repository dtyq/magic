import { useTranslation } from "react-i18next"
import { memo } from "react"
import AgreePolicyCheckbox from "@/opensource/pages/login/components/AgreePolicyCheckbox"

interface FooterProps {
	agree: boolean
	onAgreeChange: (agree: boolean) => void
	tipVisible?: boolean
}

const Footer = memo(function Footer({ agree, onAgreeChange, tipVisible = false }: FooterProps) {
	const { t } = useTranslation("login")

	return (
		<div className="mt-6 flex flex-col items-center gap-3" data-testid="login-footer">
			<AgreePolicyCheckbox agree={agree} onChange={onAgreeChange} showCheckbox />
			{tipVisible && (
				<span
					className="text-center text-sm font-normal leading-5 text-foreground/35"
					data-testid="login-footer-tip"
				>
					{t("autoRegisterTip")}
				</span>
			)}
		</div>
	)
})

export default Footer
