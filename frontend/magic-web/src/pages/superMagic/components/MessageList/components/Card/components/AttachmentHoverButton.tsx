import { useState } from "react"
import { Paperclip } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { cn } from "@/lib/utils"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type {
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import pubsub from "@/utils/pubsub"
import { handleProjectFileMention } from "@/pages/superMagic/components/MessageEditor/utils"
import { useTranslation } from "react-i18next"

interface AttachmentHoverButtonProps {
	attachments: MentionListItem[]
	t: (key: string, options?: Record<string, unknown>) => string
	className?: string
}

function AttachmentHoverButton({ attachments, t, className }: AttachmentHoverButtonProps) {
	const fileCount = attachments.length
	const [open, setOpen] = useState(false)
	const { t: tSuper } = useTranslation("super")

	if (fileCount === 0) return null

	const handleFileClick = (mentionData: ProjectFileMentionData | UploadFileMentionData) => {
		// 处理文件 mention 数据
		const result = handleProjectFileMention(mentionData as ProjectFileMentionData, tSuper)

		// 切换到文件面板
		pubsub.publish("super_magic_switch_detail_mode", "files")

		// 打开文件
		const fileId = result?.data?.file_id || result?.currentFileId
		if (result && fileId) {
			pubsub.publish("super_magic_open_file_tab", {
				fileId,
				fileData: result,
			})
		}

		// 关闭弹窗
		setOpen(false)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex h-6 items-center gap-1.5 rounded-md border-0 bg-transparent px-2 text-xs font-normal leading-4 text-foreground transition-all hover:bg-fill",
						className,
					)}
				>
					<Paperclip size={16} className="shrink-0" />
					<span>
						{t("fileUpload.attachmentCount", {
							count: fileCount,
							defaultValue: `${fileCount} 个附件`,
						})}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="start"
				sideOffset={8}
				className="z-[1200] w-[320px] rounded-lg border border-border bg-popover p-2.5 shadow-md"
			>
				{/* Header */}
				<div className="mb-2.5 w-full">
					<p className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-5 text-foreground">
						{t("fileUpload.attachments", {
							count: fileCount,
							defaultValue: `附件 (${fileCount})`,
						})}
					</p>
				</div>

				{/* Attachment List */}
				<div className="flex w-full flex-col gap-1">
					{attachments.map((mention) => {
						const mentionData = mention.attrs?.data as
							| ProjectFileMentionData
							| UploadFileMentionData
						const fileName = mentionData?.file_name || ""
						const fileId = mentionData?.file_id || ""
						const fileExtension = mentionData?.file_extension || ""

						return (
							<button
								key={fileId}
								type="button"
								className="relative flex w-full cursor-pointer items-center gap-2 overflow-clip rounded-sm px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
								onClick={() => handleFileClick(mentionData)}
							>
								{/* File Icon */}
								<div className="flex h-6 w-6 shrink-0 items-center justify-center">
									<MagicFileIcon type={fileExtension} size={24} />
								</div>

								{/* File Name */}
								<p className="mb-0 flex min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-foreground">
									{fileName}
								</p>
							</button>
						)
					})}
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default AttachmentHoverButton
