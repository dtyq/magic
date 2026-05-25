import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import MagicIcon from "@/components/base/MagicIcon"
import { IconChevronDown, IconChevronRight, IconDownload, IconEye } from "@tabler/icons-react"
import {
	downloadFileByPath,
	openFileByPath,
	type FilePathAttachment,
} from "@/pages/superMagic/components/MessageList/utils/attachmentByFilePath"

interface FilePathAttachmentListProps {
	attachments: FilePathAttachment[]
	className?: string
}

function FilePathAttachmentListInner({ attachments, className }: FilePathAttachmentListProps) {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(false)

	if (attachments.length === 0) return null

	const toggleExpanded = (e: React.MouseEvent) => {
		e.stopPropagation()
		setExpanded(!expanded)
	}

	const displayedAttachments =
		expanded || attachments.length < 4 ? attachments : attachments.slice(0, 4)

	return (
		<div className={cn("flex w-full flex-col rounded-md", className)}>
			<div
				className={cn(
					"flex items-center gap-1",
					attachments.length > 4 && "cursor-pointer",
				)}
				onClick={(e) => {
					if (attachments.length > 4) toggleExpanded(e)
				}}
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
							onClick={() => openFileByPath(attachment)}
						>
							<div
								className={cn(
									"flex items-center gap-2 rounded-[12px] p-2.5 transition-all duration-300",
									"bg-fill",
									"hover:bg-fill-secondary",
								)}
							>
								<MagicFileIcon
									type={attachment.fileExt}
									size={24}
									className="shrink-0"
								/>
								<span
									className={cn(
										"mr-2 flex-1 text-foreground",
										"min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
									)}
								>
									{attachment.fileName}
								</span>
								<MagicIcon
									className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
									onClick={(e: React.MouseEvent) => {
										e.stopPropagation()
										openFileByPath(attachment)
									}}
									component={IconEye}
									stroke={2}
									size={18}
								/>
								<MagicIcon
									className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
									onClick={(e: React.MouseEvent) => {
										e.stopPropagation()
										downloadFileByPath(attachment)
									}}
									component={IconDownload}
									stroke={2}
									size={18}
								/>
							</div>
						</div>
					))}
					{!expanded && attachments.length > 4 && (
						<div
							className={cn(
								"w-full cursor-pointer rounded-md p-1 text-center",
								"border border-border text-sm font-normal text-foreground",
								"hover:bg-blue-50 dark:hover:bg-blue-500/10",
							)}
							onClick={toggleExpanded}
						>
							{t("ui.expandAllFiles")} ({attachments.length})
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export const FilePathAttachmentList = memo(FilePathAttachmentListInner)
