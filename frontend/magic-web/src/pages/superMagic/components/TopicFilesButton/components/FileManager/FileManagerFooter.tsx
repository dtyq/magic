import { ArrowUpRight, PanelsTopLeft, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import MagicTooltip from "@/components/base/MagicTooltip"

interface FileManagerFooterProps {
	onOpenFileManager: () => void
	onOpenRecycleBin?: () => void
}

export function FileManagerFooter({ onOpenFileManager, onOpenRecycleBin }: FileManagerFooterProps) {
	const { t } = useTranslation("super")
	if (!onOpenRecycleBin)
		return (
			<div className="shrink-0 border-t border-border/60 p-2">
				<Button
					variant="ghost"
					className="h-9 w-full justify-start gap-2 rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground"
					onClick={onOpenFileManager}
				>
					<PanelsTopLeft size={16} />
					{t("userSpace.openManager")}
					<ArrowUpRight size={14} className="ml-auto" />
				</Button>
			</div>
		)

	return (
		// 中文在 240px 项目栏并排；长翻译按按钮内容宽度整颗换行，不缩字或截断操作名。
		<div className="flex shrink-0 flex-wrap gap-1 border-t border-border/60 p-2">
			<MagicTooltip title={t("fileManager.recycle.projectEntryHint")}>
				<Button
					variant="ghost"
					className="h-9 min-w-max flex-[1_0_calc(50%-2px)] justify-center gap-1.5 rounded-lg px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
					onClick={onOpenRecycleBin}
				>
					<Trash2 size={16} />
					{t("fileManager.recycle.projectTitle")}
				</Button>
			</MagicTooltip>
			<MagicTooltip title={t("fileManager.entryHint")}>
				<Button
					variant="ghost"
					className="h-9 min-w-max flex-[1_0_calc(50%-2px)] justify-center gap-1.5 rounded-lg px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
					onClick={onOpenFileManager}
				>
					<PanelsTopLeft size={16} />
					{t("fileManager.entry")}
				</Button>
			</MagicTooltip>
		</div>
	)
}
