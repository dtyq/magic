import { Check, Copy, WrapText } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import magicToast from "@/components/base/MagicToaster/utils"
import { clipboard } from "@/utils/clipboard-helpers"
import styles from "../index.module.css"

interface MarkdownCodeBlockToolbarProps {
	language?: string
	code: string
	isWrapped: boolean
	onToggleWrap: () => void
}

export default function MarkdownCodeBlockToolbar(props: MarkdownCodeBlockToolbarProps) {
	const { language, code, isWrapped, onToggleWrap } = props
	const { t: tInterface } = useTranslation("interface")
	const { t: tSuper } = useTranslation("super")
	const [isCopied, setIsCopied] = useState(false)
	const copyResetTimerRef = useRef<number | null>(null)

	const copyLabel = tInterface("chat.markdown.copy", "复制")
	const copySuccessLabel = tSuper("common.copySuccess", "复制成功")
	const wrapLabel = tInterface("chat.markdown.wrapCode", "换行")
	const unwrapLabel = tInterface("chat.markdown.unwrapCode", "取消换行")

	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)
		}
	}, [])

	async function handleCopy() {
		try {
			await clipboard.writeText(code.trimEnd())
			magicToast.success(copySuccessLabel)
			setIsCopied(true)
			if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)
			copyResetTimerRef.current = window.setTimeout(() => setIsCopied(false), 1600)
		} catch {
			magicToast.error(tSuper("common.copyFailed", "复制失败"))
		}
	}

	return (
		<div className={styles.codeBlockToolbar}>
			<span className={styles.codeBlockLanguage}>{language ?? ""}</span>
			<div className={styles.codeBlockActions}>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={isWrapped ? unwrapLabel : wrapLabel}
								aria-pressed={isWrapped}
								onClick={onToggleWrap}
								className="h-6 w-6 rounded-sm text-foreground hover:bg-transparent hover:text-foreground"
							>
								<WrapText className="h-4 w-4" />
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">
						{isWrapped ? unwrapLabel : wrapLabel}
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={isCopied ? copySuccessLabel : copyLabel}
								onClick={handleCopy}
								className="h-6 w-6 rounded-sm text-foreground hover:bg-transparent hover:text-foreground"
							>
								{isCopied ? (
									<Check className="h-4 w-4" />
								) : (
									<Copy className="h-4 w-4" />
								)}
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">{copyLabel}</TooltipContent>
				</Tooltip>
			</div>
		</div>
	)
}
