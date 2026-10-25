import { useTranslation } from "react-i18next"
import { Files, FolderOpen, LocateFixed, X } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { FileResourceIcon } from "../../../TopicFilesButton/components/FileResourceIcon"
import type { FilePresentation } from "../../../TopicFilesButton/utils/file-presentation"
import IconProject from "../../../icons/IconProject"

export type MentionSelectionItem = {
	key: string
	sourceName: string
} & (
	| { presentation: FilePresentation; projectName?: never }
	| { projectName: string; presentation?: never }
)

interface Props {
	items: readonly MentionSelectionItem[]
	onRemove: (key: string) => void
	onClear: () => void
	onNavigate?: (key: string, target: "project" | "file") => void
}

/** 清单展示由调用方持有的引用；文件管理器的当前目录、搜索结果不决定清单内容。 */
export function MentionSelectionPanel({ items, onRemove, onClear, onNavigate }: Props) {
	const { t } = useTranslation("super")
	const renderLocation = (key: string, label: string, target: "project" | "file") => {
		const Icon = target === "project" ? FolderOpen : LocateFixed
		const content = (
			<SmartTooltip
				elementType="span"
				className="block min-w-0 flex-1 truncate text-[11px] text-muted-foreground"
			>
				{label}
			</SmartTooltip>
		)
		return onNavigate ? (
			<Button
				variant="link"
				className="flex h-auto w-full justify-start gap-1.5 rounded-sm p-0 text-left font-normal text-muted-foreground"
				aria-label={
					target === "project"
						? t("fileManager.openSelectedProject", { name: label })
						: t("fileManager.locateSelectedFile", { path: label })
				}
				onClick={() => onNavigate(key, target)}
			>
				<Icon size={16} aria-hidden="true" className="shrink-0" />
				{content}
			</Button>
		) : (
			content
		)
	}
	return (
		<aside
			aria-label={t("fileManager.selectedFiles")}
			className="flex min-h-0 w-60 shrink-0 flex-col border-l bg-muted/20"
		>
			<div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
				<h3 className="flex items-center gap-2 text-sm font-medium">
					{t("fileManager.selectedFiles")}
					<span
						aria-live="polite"
						className="rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums"
					>
						{items.length}
					</span>
				</h3>
				<Button
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs text-muted-foreground"
					disabled={!items.length}
					onClick={onClear}
				>
					{t("fileManager.clearSelection")}
				</Button>
			</div>
			{items.length ? (
				<ScrollArea
					className="min-h-0 flex-1"
					viewportClassName="[&>div]:!block"
					scrollShadows
				>
					<ul className="space-y-1 p-2">
						{items.map(({ key, sourceName, presentation, projectName }) => (
							<li
								key={key}
								className="group flex min-w-0 items-start gap-2 rounded-md border border-border/60 bg-background p-2"
							>
								<div className="shrink-0 pt-0.5">
									{presentation ? (
										<FileResourceIcon presentation={presentation} size={18} />
									) : (
										<IconProject />
									)}
								</div>
								<div className="min-w-0 flex-1 space-y-1">
									<SmartTooltip
										fileName
										elementType="div"
										className="truncate text-xs font-medium"
									>
										{presentation?.name ?? projectName}
									</SmartTooltip>
									{renderLocation(key, sourceName, "project")}
									{presentation && renderLocation(key, presentation.path, "file")}
								</div>
								<MagicTooltip
									title={t("fileManager.removeSelected", {
										name: presentation?.name ?? projectName,
									})}
								>
									<Button
										variant="ghost"
										size="icon"
										className="size-6 shrink-0 text-muted-foreground"
										aria-label={t("fileManager.removeSelected", {
											name: presentation?.name ?? projectName,
										})}
										onClick={() => onRemove(key)}
									>
										<X size={14} />
									</Button>
								</MagicTooltip>
							</li>
						))}
					</ul>
				</ScrollArea>
			) : (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
					<Files size={28} className="mb-1 opacity-50" />
					<p className="text-sm">{t("fileManager.selectionEmpty")}</p>
					<p className="text-xs leading-5">{t("fileManager.selectionEmptyHint")}</p>
				</div>
			)}
		</aside>
	)
}
