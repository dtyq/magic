import { Info } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"

interface MicroAppRuntimeMentionHintProps {
	className?: string
	onClick?: () => void
}

export default function MicroAppRuntimeMentionHint({
	className,
	onClick,
}: MicroAppRuntimeMentionHintProps) {
	const { t } = useTranslation("super")

	return (
		<button
			type="button"
			className={cn(
				"group inline-flex items-center gap-1.5 text-left text-xs leading-5 text-muted-foreground",
				onClick ? "cursor-pointer hover:text-foreground" : undefined,
				className,
			)}
			onClick={onClick}
			data-testid="micro-app-runtime-mention-hint"
		>
			<Info className="size-3.5 shrink-0" aria-hidden />
			<span>
				{t("microAppPage.conversation.mentionAppHintPrefix")}
				<span className="inline-grid">
					<span className="col-start-1 row-start-1 group-hover:invisible">
						{t("microAppPage.conversation.mentionAppHintAction")}
					</span>
					<span className="invisible col-start-1 row-start-1 group-hover:visible">
						{t("microAppPage.conversation.mentionAppHintHoverAction")}
					</span>
				</span>
			</span>
		</button>
	)
}
