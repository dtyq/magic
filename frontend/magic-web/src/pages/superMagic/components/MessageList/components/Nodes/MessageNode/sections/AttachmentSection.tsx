import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import type { FilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { useFileAccess } from "@/pages/superMagic/providers/FileAccessProvider"
import { memo, useMemo, useRef, type MouseEvent } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { IconChevronDown, IconChevronRight, IconDownload, IconEye } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { cn } from "@/utils/cn"
import { Attachment } from "@/pages/superMagic/components/MessageList/components/MessageAttachment"
import type { AttachmentProps } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/type"
import { normalizeWorkspacePathForComparison } from "@/pages/superMagic/utils/markdownFileReference"
import {
	useMessageListContext,
	useMessageListProjectFilesStore,
} from "@/pages/superMagic/components/MessageList/context"
import {
	buildFilePathAttachments,
	findFilePathAttachment,
	openFileByPath,
	type FilePathAttachment,
} from "@/pages/superMagic/components/MessageList/utils/attachmentByFilePath"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import { superMagicStore } from "@/pages/superMagic/stores"
import { useMessageViewState } from "@/pages/superMagic/components/MessageList/view-state/MessageViewStateContext"
import { useFilePathAttachmentDownload } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/hooks/useFilePathAttachmentDownload"
import {
	canRenderFinalAttachments,
	resolveAttachmentList,
} from "@/pages/superMagic/components/MessageList/message-render-contract"
import {
	HomeOnboardingAnchor,
	startHomeOnboardingDeliverableRunIfDue,
} from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"

interface AttachmentSectionProps {
	node?: Record<string, unknown>
	fallbackNode?: { attachments?: unknown }
	prevSuperMessageId?: string
	onFileClick?: (fileItem: unknown) => void
	onSelectDetail?: (detail: unknown) => void
	/** Applied to whichever branch renders, so callers never wrap a section that returns null. */
	className?: string
}

export const AttachmentSection = observer(function AttachmentSection({
	node,
	fallbackNode,
	prevSuperMessageId,
	onFileClick: handleFileClick,
	onSelectDetail,
	className,
}: AttachmentSectionProps) {
	const resolvedProjectFilesStore = useMessageListProjectFilesStore()
	const { renderAttachments } = useMessageListContext()
	const canDisplayAttachments = canRenderFinalAttachments(node)
	const attachments = canDisplayAttachments
		? (resolveAttachmentList(node, fallbackNode) as AttachmentProps[])
		: []

	const rawFilePathAttachments = useMemo(() => {
		if (!canDisplayAttachments || !prevSuperMessageId) return []
		const prevMessageNode = superMagicStore.getMessageNode(prevSuperMessageId) as
			Record<string, unknown> | undefined
		const prevContent =
			typeof prevMessageNode?.content === "string" ? prevMessageNode.content : ""
		if (!prevContent) return []
		const seenReferences = new Set<string>()
		return buildFilePathAttachments(prevContent).filter((attachment) => {
			// 同一路径的 Markdown 与旧语法有不同解码规则；只跳过语义相同的重复查找。
			const referenceKey = `${attachment.source}\u0000${attachment.filePath}`
			if (seenReferences.has(referenceKey)) return false
			seenReferences.add(referenceKey)
			return true
		})
	}, [canDisplayAttachments, prevSuperMessageId])

	const seenFilePaths = new Set<string>()
	const filePathAttachments = rawFilePathAttachments.flatMap((attachment) => {
		const found = findFilePathAttachment(
			resolvedProjectFilesStore?.workspaceFilesList ?? [],
			attachment,
		)
		if (!found || found.type === "directory" || found.is_directory) return []
		// 文件打开事件使用已匹配的真实路径，不把旧语法编码留给下游猜测。
		const filePath = normalizeWorkspacePathForComparison(
			found.relative_file_path || found.path || attachment.filePath,
		)
		// 不同引用写法可能指向同一真实文件，按完整路径去重并保留首次出现的顺序。
		if (!filePath || seenFilePaths.has(filePath)) return []
		seenFilePaths.add(filePath)
		return [
			{
				...attachment,
				filePath,
				file: found,
				presentation: resolveFilePresentation(found, {
					context: resolvedProjectFilesStore.filePresentationContext,
					index: resolvedProjectFilesStore.filePresentationIndex,
				}),
			},
		]
	})
	const onFileClick = useMemoizedFn((item?: unknown) => {
		openMessageFile(item)
		onSelectDetail?.(item)
	})

	if (!canDisplayAttachments) return null
	const scopedFiles =
		filePathAttachments.length > 0
			? filePathAttachments.map((attachment) => attachment.file)
			: attachments
	const scopedAttachments =
		scopedFiles.length > 0 ? renderAttachments?.({ files: scopedFiles, className }) : null
	if (scopedAttachments) return scopedAttachments
	if (attachments.length > 0) {
		return (
			<Attachment
				className={className}
				attachments={attachments}
				onSelectDetail={onFileClick}
				onFileClick={handleFileClick}
			/>
		)
	}
	if (filePathAttachments.length > 0) {
		return <FilePathAttachmentList attachments={filePathAttachments} className={className} />
	}
	return null
})

interface FilePathAttachmentListProps {
	attachments: Array<FilePathAttachment & { presentation: FilePresentation }>
	className?: string
}

const FilePathAttachmentList = memo(function FilePathAttachmentList({
	attachments,
	className,
}: FilePathAttachmentListProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useMessageViewState("file-path-attachments-expanded", false)
	const downloadFileByPath = useFilePathAttachmentDownload()
	/**
	 * The block the new-user guide frames when it is opened from here.
	 *
	 * Marked by hand rather than declared in the markup, because the guide has to point at the block
	 * that was *clicked* and nothing in the markup can tell the blocks apart: the message list holds
	 * one of these per message, and they all look the same. See the tour's first step — the mark is
	 * its anchor, and the entry that decides the tour is due is the only thing that knows which
	 * block it belongs on.
	 */
	const sectionRef = useRef<HTMLDivElement>(null)
	const { permissions: access } = useFileAccess()

	if (attachments.length === 0) return null

	/**
	 * Opening one of these files — unless this is the first of them a new account has ever asked
	 * for, in which case the guide takes the click and nothing is opened.
	 *
	 * The guide is about these files rather than about the one that was clicked: it says what a
	 * task's results are and where they are kept, and both of its sentences are about the block the
	 * user is looking at. Opening the file underneath would put that explanation on a screen the
	 * user has not been introduced to yet, and the frame the first step draws around the block would
	 * be over a panel that has just been replaced by the file's contents. So the click buys the
	 * guide alone; the next one — what the guide's own words invite — opens the file, and every
	 * click after that behaves as it always did.
	 *
	 * The block is still marked as the guide's anchor, and marked before the early return: the mark
	 * is what the first step points at, and it is the only thing that can tell the guide which of
	 * the page's attachment blocks was clicked. See `startHomeOnboardingDeliverableRunIfDue`.
	 */
	const openAttachment = (
		attachment: FilePathAttachment & { presentation: FilePresentation },
	) => {
		if (startHomeOnboardingDeliverableRunIfDue()) {
			sectionRef.current?.setAttribute(
				"data-guide-anchor",
				HomeOnboardingAnchor.DeliverableAttachment,
			)
			return
		}
		openFileByPath(attachment)
	}

	const toggleExpanded = (event: MouseEvent) => {
		event.stopPropagation()
		setExpanded(!expanded)
	}
	const displayedAttachments =
		expanded || attachments.length < 4 ? attachments : attachments.slice(0, 4)

	return (
		<div ref={sectionRef} className={cn("flex w-full flex-col rounded-md", className)}>
			<div
				className={cn(
					"flex items-center gap-1",
					attachments.length > 4 && "cursor-pointer",
				)}
				onClick={(event) => {
					if (attachments.length > 4) toggleExpanded(event)
				}}
				data-testid="toggle-expanded"
			>
				<div className="mr-1 text-sm font-medium text-foreground">
					{t("ui.attachments", { count: attachments.length })}
				</div>
				{attachments.length > 4 &&
					(expanded ? (
						<IconChevronDown className="size-[18px] shrink-0 text-foreground" />
					) : (
						<IconChevronRight className="size-[18px] shrink-0 text-foreground" />
					))}
			</div>
			{!!displayedAttachments.length && (
				<div className="mt-2 flex flex-wrap gap-2">
					{displayedAttachments.map((attachment) => (
						<div
							key={attachment.filePath}
							className="w-full cursor-pointer"
							onClick={() => {
								if (access.view && access.preview) openAttachment(attachment)
							}}
							data-testid="open-file-by-path"
						>
							<div
								className={cn(
									"flex items-center gap-2 rounded-[12px] p-2.5 transition-all duration-300",
									"bg-fill hover:bg-fill-secondary",
								)}
							>
								<FileResourceIcon
									presentation={attachment.presentation}
									size={24}
									className="shrink-0"
								/>
								<span className="mr-2 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-foreground">
									{attachment.fileName}
								</span>
								{access.view && access.preview && (
									<MagicIcon
										className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
										onClick={(event: MouseEvent) => {
											event.stopPropagation()
											if (access.view && access.preview)
												openAttachment(attachment)
										}}
										component={IconEye}
										stroke={2}
										size={18}
									/>
								)}
								{access.download && (
									<MagicIcon
										className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
										onClick={(event: MouseEvent) => {
											event.stopPropagation()
											downloadFileByPath(attachment)
										}}
										component={IconDownload}
										stroke={2}
										size={18}
									/>
								)}
							</div>
						</div>
					))}
					{!expanded && attachments.length > 4 && (
						<div
							className={cn(
								"w-full cursor-pointer rounded-md border border-border p-1 text-center text-sm font-normal text-foreground",
								"hover:bg-blue-50 dark:hover:bg-blue-500/10",
							)}
							onClick={toggleExpanded}
							data-testid="toggle-expanded-2"
						>
							{t("ui.expandAllFiles")} ({attachments.length})
						</div>
					)}
				</div>
			)}
		</div>
	)
})
