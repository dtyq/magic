import { ChevronLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PORTAL_IDS } from "@/constants"

interface ChatProjectHeaderProps {
	projectName?: string | null
	onBackClick?: () => void
}

export function ChatProjectHeader({ projectName, onBackClick }: ChatProjectHeaderProps) {
	const { t } = useTranslation("super")

	return (
		<div
			className="flex h-[50px] items-center gap-2 rounded-b-xl border-b bg-background p-2.5"
			data-testid="chat-project-header-root"
		>
			<button
				type="button"
				onClick={onBackClick}
				className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent"
				aria-label={t("common.back")}
				data-testid="chat-project-header-back-button"
			>
				<ChevronLeft size={20} strokeWidth={1.5} />
			</button>
			<div className="min-w-0 flex-1">
				<p
					className="truncate text-base font-medium text-foreground"
					data-testid="chat-project-header-title"
				>
					{projectName || t("chat.unnamedChat")}
				</p>
			</div>
			<div
				className="flex shrink-0 items-center gap-1 text-muted-foreground"
				data-testid="chat-project-header-actions"
			>
				<div
					className="flex items-center justify-center"
					id={PORTAL_IDS.SUPER_MAGIC_MOBILE_CHAT_HEADER_RIGHT_FILES_BUTTON}
				/>
				<div
					className="flex items-center justify-center"
					id={PORTAL_IDS.SUPER_MAGIC_MOBILE_CHAT_HEADER_RIGHT_SHARE_BUTTON}
				/>
				<div
					className="flex items-center justify-center"
					id={PORTAL_IDS.SUPER_MAGIC_MOBILE_CHAT_HEADER_RIGHT_MORE_BUTTON}
				/>
			</div>
		</div>
	)
}
