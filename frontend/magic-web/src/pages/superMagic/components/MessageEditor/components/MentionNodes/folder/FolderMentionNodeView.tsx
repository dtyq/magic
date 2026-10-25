import { useOptionalMessageEditorStore } from "../../../stores"
import { NodeViewWrapper } from "@/infrastructure/editors/tiptap/react"
import { observer } from "mobx-react-lite"
import { useCallback, type MouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { X } from "lucide-react"
import {
	getMentionDisplayName,
	type MentionNodeViewRendererProps,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { DirectoryMentionData } from "@/components/business/MentionPanel/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { ProjectDirectoryMentionIcon } from "./ProjectDirectoryMentionIcon"

interface FolderMentionNodeViewProps extends MentionNodeViewRendererProps {
	getWorkspaceFilesList?: () => AttachmentItem[]
}

function FolderMentionNodeView({
	attrs,
	deleteNode,
	selected,
	getWorkspaceFilesList,
}: FolderMentionNodeViewProps) {
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")
	const fileStore = useOptionalMessageEditorStore()?.fileUploadStore.getProjectFilesStore()
	const workspaceFilesList = getWorkspaceFilesList?.() ?? []
	const data = attrs.data as DirectoryMentionData
	const displayName = getMentionDisplayName(attrs)

	const handleMouseDown = useCallback((event: MouseEvent) => {
		event.preventDefault()
	}, [])

	const handleRemove = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			event.preventDefault()
			event.stopPropagation()
			deleteNode?.()
		},
		[deleteNode],
	)

	return (
		<NodeViewWrapper
			as="span"
			className={cn(
				"magic-mention relative !inline-flex max-w-full !cursor-grab select-none !overflow-visible !bg-transparent !p-0 !align-middle",
				attrs.pending && "opacity-50",
			)}
			contentEditable={false}
			draggable={false}
			data-magic-editor-node
			data-mention-node-view="folder"
			data-testid="folder-mention-node-view"
			data-type={attrs.type}
			data-data={JSON.stringify(attrs.data || {})}
			onMouseDown={handleMouseDown}
		>
			<span
				className={cn(
					"relative inline-flex min-w-0 max-w-[220px] items-center gap-1 overflow-hidden",
					isMobile
						? "mb-1 rounded-full bg-muted py-0.5 pl-2 pr-1 text-sm text-foreground"
						: "h-[18px] rounded bg-primary-10 px-1 leading-none text-primary",
					selected && "ring-1 ring-primary/40",
				)}
				data-testid="folder-mention-visual"
			>
				<span className="relative z-10 flex shrink-0 items-center">
					<ProjectDirectoryMentionIcon
						context={
							attrs.type === MentionItemType.USER_DIRECTORY
								? { kind: "user" }
								: fileStore?.filePresentationContext
						}
						data={data}
						workspaceFilesList={workspaceFilesList}
						size={16}
					/>
				</span>
				<span
					className="relative z-10 min-w-0 truncate"
					title={
						attrs.type === MentionItemType.USER_DIRECTORY
							? data.directory_path
							: displayName
					}
				>
					{displayName}
				</span>
				{isMobile && (
					<button
						type="button"
						className="relative z-10 inline-flex size-4 shrink-0 items-center justify-center rounded-full"
						onMouseDown={handleMouseDown}
						onClick={handleRemove}
						aria-label={t("uploadModal.removeFile")}
					>
						<X size={16} />
					</button>
				)}
			</span>
		</NodeViewWrapper>
	)
}

export default observer(FolderMentionNodeView)
