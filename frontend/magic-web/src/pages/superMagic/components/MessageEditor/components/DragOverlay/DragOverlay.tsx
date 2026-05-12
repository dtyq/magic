import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Upload } from "lucide-react"

export interface DragOverlayProps {
	visible: boolean
}

const overlayClassName = cn("absolute inset-0 z-10 rounded-md", "bg-white/80 dark:bg-background/80")

const contentClassName = cn(
	"absolute left-1/2 top-1/2 flex min-w-[240px] -translate-x-1/2 -translate-y-1/2",
	"flex-col items-center justify-center gap-2.5 text-center",
)

const iconClassName = "text-primary"

const textClassName = "text-xs font-normal leading-4 text-foreground/80"

const DragOverlay: React.FC<DragOverlayProps> = ({ visible = false }: DragOverlayProps) => {
	const { t } = useTranslation("super")

	if (!visible) return null

	return (
		<div className={overlayClassName}>
			<div className={contentClassName}>
				<Upload className={iconClassName} />
				<div className={textClassName}>{t("messageEditor.dragDropFilesHint")}</div>
			</div>
		</div>
	)
}

export default DragOverlay
