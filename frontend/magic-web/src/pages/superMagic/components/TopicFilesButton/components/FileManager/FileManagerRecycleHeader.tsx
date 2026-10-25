import { ArrowLeft } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import SmartTooltip from "@/components/other/SmartTooltip"

interface FileManagerRecycleHeaderProps {
	projectName?: string
	onBack: () => void
}

export function FileManagerRecycleHeader({ projectName, onBack }: FileManagerRecycleHeaderProps) {
	const { t } = useTranslation("super")
	return (
		<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-4 py-2 text-sm font-medium">
			<Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5" onClick={onBack}>
				<ArrowLeft size={16} />
				{projectName !== undefined
					? t("fileManager.recycle.backToProject")
					: t("fileManager.recycle.back")}
			</Button>
			<SmartTooltip className="min-w-0 flex-1 text-sm font-medium">
				{projectName !== undefined
					? t("fileManager.recycle.projectHeading", { name: projectName })
					: t("fileManager.recycle.title")}
			</SmartTooltip>
		</div>
	)
}
