import { Dialog, DialogContent, DialogTitle } from "@/components/shadcn-ui/dialog"
import ConnectorMCPForm from "./ConnectorMCPForm"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import type { IMCPItem } from "@/components/Agent/MCP/types"

interface ConnectorCreateDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onSuccess: () => void
	connector?: IMCPItem | null
	className?: string
	zIndex?: number
}

/**
 * Reuses the complete MCP creation form from the input-box plugin panel while
 * keeping the market entry point fully controlled by the page.
 */
export default function ConnectorCreateDialog({
	open,
	onOpenChange,
	onSuccess,
	connector = null,
	className,
	zIndex,
}: ConnectorCreateDialogProps) {
	const { t } = useTranslation("crew/market")
	const nestedLayerZIndex = (zIndex ?? 1000) + 10

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				showCloseButton={false}
				onEscapeKeyDown={(event) => event.stopPropagation()}
				aria-describedby={undefined}
				className={cn(
					"!min-w-0 !max-h-[calc(100%-2rem)] !w-[calc(100%-2rem)] !max-w-[760px] !overflow-hidden !rounded-xl !border !bg-background !p-0 !shadow-sm",
					className,
				)}
				style={zIndex ? { zIndex } : undefined}
				data-testid="connector-create-dialog"
			>
				<DialogTitle className="sr-only">{t("connectors.create")}</DialogTitle>
				<ConnectorMCPForm
					key={connector?.id ?? "new"}
					connector={connector}
					nestedLayerZIndex={nestedLayerZIndex}
					onClose={() => onOpenChange(false)}
					onSuccessCallback={onSuccess}
				/>
			</DialogContent>
		</Dialog>
	)
}
