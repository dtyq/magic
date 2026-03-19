import MagicFileIcon from "@/components/base/MagicFileIcon"
import { getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { getFileType, downloadFileWithAnchor } from "@/pages/superMagic/utils/handleFIle"
import { useState } from "react"
import type { AttachmentProps } from "./type"
import MagicIcon from "@/components/base/MagicIcon"
import { IconChevronDown, IconChevronRight, IconDownload, IconEye } from "@tabler/icons-react"
import FolderIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { useTranslation } from "react-i18next"
import { getAttachmentType } from "./utils"
import { isEmpty } from "lodash-es"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { cn } from "@/lib/utils"

export const Attachment = ({
	attachments,
	onSelectDetail,
	onFileClick,
}: {
	attachments?: Array<AttachmentProps>
	onSelectDetail: any
	onFileClick?: (fileItem: any) => void
}) => {
	const { t } = useTranslation("super")
	const [expanded, setExpanded] = useState(false)
	const toggleExpanded = (e: any) => {
		e.stopPropagation()
		setExpanded(!expanded)
	}

	const handleDownload = (file_id: string) => {
		getTemporaryDownloadUrl({ file_ids: [file_id], is_download: true }).then((res: any) => {
			downloadFileWithAnchor(res[0]?.url)
		})
	}

	const displayedAttachments =
		expanded || !attachments || attachments.length < 4 ? attachments : attachments.slice(0, 4)

	const show = Array.isArray(attachments) && attachments.length > 0

	const handleOpenFile = (item: any) => {
		if (onFileClick && item.file_id) {
			onFileClick(item)

			pubsub.publish(PubSubEvents.Locate_File_In_Tree, item.file_id)
			return
		}

		const fileName = item.display_filename || item.file_name || item.filename
		const type = getFileType(item.file_extension)
		if (type) {
			onSelectDetail?.({
				type, // 根据文件扩展名确定类型
				data: {
					// content: data,
					file_name: fileName,
					// file_url: res[0]?.url,
					file_extension: item.file_extension,
					file_id: item.file_id,
					metadata: item.metadata,
				},
				currentFileId: item.file_id,
			})
		} else {
			onSelectDetail?.({
				type: "empty",
				data: {
					text: t("ui.filePreviewNotSupported"),
				},
			})
		}
	}
	const getMetaDataName = (item: any) => {
		return item?.name ? `${item?.name}` : null
	}
	if (!show) return null
	return (
		<div className="flex w-full flex-col rounded-md">
			<div
				className={cn(
					"flex items-center gap-1",
					attachments.length > 4 && "cursor-pointer",
				)}
				onClick={(e) => {
					if (attachments.length > 4) {
						toggleExpanded(e)
					}
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
			{!!displayedAttachments?.length && (
				<div className="mt-2 flex flex-wrap gap-2">
					{displayedAttachments?.map((item: AttachmentProps) => {
						const { metadata } = item
						const isFolder = item.file_extension === ""
						return (
							<div
								key={item.file_id}
								className="w-full cursor-pointer"
								onClick={(e) => {
									if (isFolder && !metadata) {
										return
									}
									e.stopPropagation()
									handleOpenFile(item)
								}}
							>
								<div
									className={cn(
										"flex items-center gap-2 rounded-[12px] p-2.5 transition-all duration-300",
										"bg-fill",
										"hover:bg-fill-secondary",
									)}
								>
									{isFolder && !metadata ? (
										<img src={FolderIcon} alt="folder" width={24} height={24} />
									) : (
										<MagicFileIcon
											type={
												getAttachmentType(metadata) || item.file_extension
											}
											size={24}
											className="shrink-0"
										/>
									)}

									<span
										className={cn(
											"mr-2 flex-1 text-foreground",
											"min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
										)}
									>
										{getMetaDataName(metadata) ||
											item.display_filename ||
											item.file_name ||
											item.filename}
									</span>
									<MagicIcon
										className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
										onClick={(e: any) => {
											e.stopPropagation()
											handleOpenFile(item)
										}}
										component={IconEye}
										stroke={2}
										size={18}
									/>
									{isEmpty(item.metadata) && (
										<MagicIcon
											className="shrink-0 cursor-pointer text-muted-foreground [&_svg]:text-muted-foreground hover:[&_svg]:text-foreground/80"
											onClick={(e: any) => {
												e.stopPropagation()
												handleDownload(item.file_id)
											}}
											component={IconDownload}
											stroke={2}
											size={18}
										/>
									)}
								</div>
							</div>
						)
					})}
					{!expanded && attachments && attachments.length > 4 && (
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
