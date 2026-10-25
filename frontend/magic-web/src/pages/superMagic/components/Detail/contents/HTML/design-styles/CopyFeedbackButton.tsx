import { Check, Copy } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { copyToClipboard } from "./copyToClipboard"

interface CopyFeedbackButtonProps {
	value: string
	label?: string
	children?: ReactNode
	className?: string
	iconOnly?: boolean
}

export default function CopyFeedbackButton({
	value,
	label,
	children,
	className = "",
	iconOnly = false,
}: CopyFeedbackButtonProps) {
	const { t } = useTranslation("super")
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		if (!copied) return
		const timeout = window.setTimeout(() => setCopied(false), 1600)
		return () => window.clearTimeout(timeout)
	}, [copied])

	const handleCopy = async () => {
		if (await copyToClipboard(value)) setCopied(true)
	}

	return (
		<button
			type="button"
			className={`inline-flex min-h-7 items-center justify-center gap-1.5 rounded-md px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] ${className}`}
			onClick={handleCopy}
			aria-label={label ?? t("htmlEditor.designStyle.copyToken")}
			title={label ?? t("htmlEditor.designStyle.copyToken")}
		>
			{copied ? (
				<Check className="size-4 text-emerald-600" aria-hidden="true" />
			) : (
				<Copy className="size-4" aria-hidden="true" />
			)}
			{!iconOnly &&
				(copied
					? t("htmlEditor.designStyle.copied")
					: (children ?? t("htmlEditor.designStyle.copy")))}
		</button>
	)
}
