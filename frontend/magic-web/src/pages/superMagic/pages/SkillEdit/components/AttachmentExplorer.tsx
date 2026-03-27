import {
	ChevronDown,
	ChevronRight,
	FilePlus,
	FileText,
	Folder,
	FolderPlus,
	RefreshCw,
	Search,
	SquareCheckBig,
	Upload,
} from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import type { SkillEditAttachmentItem } from "../store/types"

interface AttachmentExplorerProps {
	title: string
	searchLabel: string
	newFileLabel: string
	newFolderLabel: string
	uploadLabel: string
	refreshLabel: string
	selectLabel: string
	attachments: SkillEditAttachmentItem[]
	selectedAttachmentId: string | null
	expandedFolderIds: string[]
	onToggleFolder: (id: string) => void
	onSelectAttachment: (id: string) => void
}

function AttachmentExplorer({
	title,
	searchLabel,
	newFileLabel,
	newFolderLabel,
	uploadLabel,
	refreshLabel,
	selectLabel,
	attachments,
	selectedAttachmentId,
	expandedFolderIds,
	onToggleFolder,
	onSelectAttachment,
}: AttachmentExplorerProps) {
	return (
		<div
			className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-background p-2"
			data-testid="skill-edit-attachments-panel"
		>
			<div className="flex h-8 items-center justify-between overflow-hidden px-2">
				<p className="truncate text-sm font-medium leading-none text-foreground">{title}</p>
				<div className="flex items-center gap-1">
					<ActionIconButton
						label={searchLabel}
						testId="skill-edit-search-files-button"
						icon={<Search className="size-4" />}
					/>
					<ActionIconButton
						label={newFileLabel}
						testId="skill-edit-new-file-button"
						icon={<FilePlus className="size-4" />}
					/>
					<ActionIconButton
						label={newFolderLabel}
						testId="skill-edit-new-folder-button"
						icon={<FolderPlus className="size-4" />}
					/>
					<ActionIconButton
						label={uploadLabel}
						testId="skill-edit-upload-files-button"
						icon={<Upload className="size-4" />}
					/>
					<ActionIconButton
						label={refreshLabel}
						testId="skill-edit-refresh-files-button"
						icon={<RefreshCw className="size-4" />}
					/>
					<ActionIconButton
						label={selectLabel}
						testId="skill-edit-select-files-button"
						icon={<SquareCheckBig className="size-4" />}
					/>
				</div>
			</div>

			<ScrollArea className="min-h-0 flex-1" data-testid="skill-edit-attachments-scroll-area">
				<div className="flex flex-col gap-0.5 pb-1">
					{renderAttachmentItems({
						items: attachments,
						depth: 0,
						selectedAttachmentId,
						expandedFolderIds,
						onToggleFolder,
						onSelectAttachment,
					})}
				</div>
			</ScrollArea>
		</div>
	)
}

function renderAttachmentItems({
	items,
	depth,
	selectedAttachmentId,
	expandedFolderIds,
	onToggleFolder,
	onSelectAttachment,
}: {
	items: SkillEditAttachmentItem[]
	depth: number
	selectedAttachmentId: string | null
	expandedFolderIds: string[]
	onToggleFolder: (id: string) => void
	onSelectAttachment: (id: string) => void
}) {
	return (
		<>
			{items.map((item) => {
				const isFolder = item.kind === "folder"
				const isExpanded = expandedFolderIds.includes(item.id)
				const isSelected = selectedAttachmentId === item.id
				const indentation = depth === 0 ? 8 : 32 + (depth - 1) * 20

				return (
					<div key={item.id}>
						<button
							type="button"
							className={cn(
								"flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left transition-colors",
								isSelected && "bg-primary/10",
							)}
							style={{ paddingLeft: indentation }}
							onClick={() =>
								isFolder ? onToggleFolder(item.id) : onSelectAttachment(item.id)
							}
							data-testid={`skill-edit-attachment-${item.id}-row`}
						>
							<div className="flex size-4 shrink-0 items-center justify-center">
								{isFolder ? (
									isExpanded ? (
										<ChevronDown className="size-4 text-muted-foreground" />
									) : (
										<ChevronRight className="size-4 text-muted-foreground" />
									)
								) : (
									<div className="size-4 opacity-0" />
								)}
							</div>
							{isFolder ? (
								<Folder className="size-4 shrink-0 text-amber-500" />
							) : (
								<FileText className="size-4 shrink-0 text-muted-foreground" />
							)}
							<p className="min-w-0 flex-1 truncate text-sm leading-none text-sidebar-foreground">
								{item.name}
							</p>
						</button>

						{isFolder && isExpanded && item.children?.length
							? renderAttachmentItems({
									items: item.children,
									depth: depth + 1,
									selectedAttachmentId,
									expandedFolderIds,
									onToggleFolder,
									onSelectAttachment,
								})
							: null}
					</div>
				)
			})}
		</>
	)
}

function ActionIconButton({
	icon,
	label,
	testId,
}: {
	icon: React.ReactNode
	label: string
	testId: string
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-6 rounded-md"
			aria-label={label}
			data-testid={testId}
		>
			{icon}
		</Button>
	)
}

export default AttachmentExplorer
