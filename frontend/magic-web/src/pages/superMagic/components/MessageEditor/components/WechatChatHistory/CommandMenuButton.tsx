import { Slash } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicTooltip from "@/components/base/MagicTooltip"
import { Button } from "@/components/shadcn-ui/button"

interface CommandMenuButtonProps {
	open: boolean
	iconSize: number
	onOpen: (anchor: HTMLElement) => void
	onDismiss: (restoreFocus?: boolean) => void
}

export default function CommandMenuButton({
	open,
	iconSize,
	onOpen,
	onDismiss,
}: CommandMenuButtonProps) {
	const { t } = useTranslation("super")
	return (
		<MagicTooltip title={t("wechatChat.commands")} disabled={open}>
			<Button
				type="button"
				variant="outline"
				className="h-auto gap-0 p-1 shadow-none"
				aria-label={t("wechatChat.commands")}
				aria-expanded={open}
				aria-haspopup="dialog"
				onMouseDown={(event) => event.preventDefault()}
				onClick={(event) => {
					if (open) onDismiss(true)
					else onOpen(event.currentTarget)
				}}
				data-testid="super-message-editor-slash-command-button"
			>
				<Slash size={iconSize} style={{ width: iconSize, height: iconSize }} />
			</Button>
		</MagicTooltip>
	)
}
