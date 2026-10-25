import { useMemo, type ReactNode } from "react"
import {
	Braces,
	ChevronRight,
	FileSpreadsheet,
	FileText,
	Globe,
	Image as ImageIcon,
	Presentation,
} from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { cn } from "@/utils/cn"
import { usePersonaResearchStore } from "../context"
import { getAttachmentPath } from "../services/researchFiles"
import {
	groupStudyFiles,
	type StudyFileEntry,
	type StudyFileGroupKey,
} from "../services/studyFileGroups"

/** Picks an icon by file type, so documents, tables and data read apart at a glance. */
function iconOf(file: AttachmentItem): ReactNode {
	const extension = getAttachmentPath(file).split(".").pop()?.toLowerCase() ?? ""
	const className = "size-4 shrink-0 text-muted-foreground"
	if (extension === "html" || extension === "htm") return <Globe className={className} />
	if (["csv", "xlsx", "xls"].includes(extension)) return <FileSpreadsheet className={className} />
	if (["ppt", "pptx"].includes(extension)) return <Presentation className={className} />
	if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(extension))
		return <ImageIcon className={className} />
	if (extension === "json") return <Braces className={className} />
	return <FileText className={className} />
}

/**
 * Every file of the current study, grouped (deliverables, process, data). Clicking a file
 * opens it in the preview beside the list, where it can be read, edited or downloaded.
 */
function StudyFileList({
	activeFileId,
	onOpenFile,
	variant,
}: {
	activeFileId?: string | null
	onOpenFile: (file: AttachmentItem) => void
	variant: "desktop" | "mobile"
}) {
	const { t } = useTranslation("personaResearch")
	const store = usePersonaResearchStore()
	const study = store.studyAttachments
	const personaFiles = store.studyPersonaFiles
	const groups = useMemo(
		() => (study ? groupStudyFiles(study, personaFiles) : []),
		[study, personaFiles],
	)
	const groupLabel: Record<StudyFileGroupKey, string> = {
		deliverables: t("files.deliverables"),
		process: t("files.process"),
		data: t("files.data"),
	}

	const labelOf = (entry: StudyFileEntry) => {
		const personaName = entry.personaId
			? (store.personaById(entry.personaId)?.name ?? entry.personaId)
			: ""
		switch (entry.role) {
			case "interview":
				return t("files.role.interview", { name: personaName })
			case "persona":
				return t("files.role.persona", { name: personaName })
			case "other":
				return getAttachmentPath(entry.file).split("/").pop() ?? ""
			default:
				return t(`files.role.${entry.role}`)
		}
	}

	if (groups.length === 0) {
		return <p className="p-4 text-xs text-muted-foreground">{t("files.empty")}</p>
	}

	return (
		// Radix's table wrapper otherwise expands to long filenames, defeating truncation.
		<ScrollArea className="h-full" viewportClassName="[&>div]:!block">
			<div className={cn("flex flex-col gap-3 p-2", variant === "mobile" && "pb-1")}>
				{groups.map((group) => (
					<Collapsible
						key={group.key}
						// Data files are many and rarely read directly; keep them folded.
						defaultOpen={group.key !== "data"}
						className="flex flex-col gap-0.5"
					>
						<CollapsibleTrigger className="group flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
							<ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
							{groupLabel[group.key]}
							<span className="tabular-nums">{group.entries.length}</span>
						</CollapsibleTrigger>
						<CollapsibleContent className="flex flex-col gap-0.5">
							{group.entries.map((entry) => {
								const fileId = String(entry.file.file_id)
								const active = activeFileId === fileId
								const fileName = getAttachmentPath(entry.file).split("/").pop()
								const label = labelOf(entry)
								return (
									<button
										key={fileId}
										type="button"
										title={getAttachmentPath(entry.file)}
										onClick={() => onOpenFile(entry.file)}
										className={cn(
											"flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left outline-none transition-colors",
											"hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring",
											active &&
												"bg-background shadow-sm ring-1 ring-border/60",
										)}
									>
										{iconOf(entry.file)}
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="truncate text-xs text-foreground">
												{label}
											</span>
											{label !== fileName ? (
												<span className="truncate text-[11px] text-muted-foreground">
													{fileName}
												</span>
											) : null}
										</span>
									</button>
								)
							})}
						</CollapsibleContent>
					</Collapsible>
				))}
			</div>
		</ScrollArea>
	)
}

export default observer(StudyFileList)
