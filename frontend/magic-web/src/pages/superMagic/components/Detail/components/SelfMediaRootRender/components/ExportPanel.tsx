import { memo } from "react"
import { Download } from "lucide-react"
import { cn } from "@/utils/cn"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"

interface ExportPanelProps {
	/** Open the export preview dialog. */
	onOpen: () => void
	className?: string
	label?: string
	disabled?: boolean
}

function ExportPanel({ onOpen, className, label = "Export ZIP", disabled }: ExportPanelProps) {
	const { t } = useTranslation("super")
	const displayLabel = label === "Export ZIP" ? t("detail.selfMedia.export.action") : label
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Button
				type="button"
				onClick={onOpen}
				disabled={disabled}
				data-testid="self-media-export-btn"
				size="sm"
				className="h-10 rounded-[14px] bg-[#18181b] px-4 text-xs font-[800] text-white shadow-[0_10px_24px_rgba(24,24,27,0.18)] hover:bg-[#27272a] disabled:bg-[#18181b]/45 max-sm:h-10 sm:h-11 sm:px-5 sm:text-sm"
			>
				<Download className="h-4 w-4 shrink-0" aria-hidden />
				{displayLabel}
			</Button>
		</div>
	)
}

export default memo(ExportPanel)
