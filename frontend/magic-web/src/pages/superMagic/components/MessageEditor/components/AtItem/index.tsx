import MagicFileIcon from "@/components/base/MagicFileIcon"
import TSIcon, { IconParkIconElement } from "@/components/base/TSIcon"
import BotIcon from "@/components/business/MentionPanel/components/icons/BotIcon"
import PlugIcon from "@/components/business/MentionPanel/components/icons/PlugIcon"
import SkillIcon from "@/components/business/MentionPanel/components/icons/SkillIcon"
import ToolIcon from "@/components/business/MentionPanel/components/icons/ToolIcon"
import FoldIcon from "@/pages/superMagic/assets/svg/file-folder.svg"
import { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	getMentionDisplayName,
	getMentionIcon,
	getMentionDescription,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	DirectoryMentionData,
	MentionItemType,
	ProjectFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { type TooltipProps } from "antd"
import { memo, useState, useCallback } from "react"
import { ImageInProjectFile, ImageInUploadFile } from "./components/AtItemPreviewImage"
import { showMobileImagePreview } from "./components/MobileImagePreview"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import { getAttachmentType } from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { cn } from "@/lib/utils"
import { MentionTooltipWrapper } from "./components/MentionTooltipWrapper"
import { JSONContent } from "@tiptap/core"
import { type MarkerClickScene } from "../../hooks/useMarkerClickHandler"
import MarkerAtItem from "../MentionNodes/marker/MarkerAtItem"

interface AtItemProps {
	data: TiptapMentionAttributes
	onRemove?: (data: TiptapMentionAttributes) => void
	className?: string
	onFileClick?: (item: TiptapMentionAttributes["data"]) => void
	placement?: TooltipProps["placement"]
	flag?: string
	onRetry?: (id: string) => Promise<void>
	iconSize?: number
	tooltipProps?: Partial<TooltipProps>
	markerTooltipProps?: {
		popoverClassName?: string
		parentPopoverOpen?: boolean
		side?: "top" | "right" | "bottom" | "left"
	}
	/** Marker 点击场景（用于决定点击行为） */
	markerClickScene?: MarkerClickScene
	/** 消息的 content（用于消息列表中通过 mark_number 查找原始 CanvasMarkerMentionData） */
	messageContent?: JSONContent | string | Record<string, unknown>
}

function AtItem({
	data,
	onRemove,
	className,
	onFileClick,
	placement,
	flag,
	onRetry,
	iconSize = 20,
	tooltipProps,
	markerTooltipProps,
	markerClickScene,
	messageContent,
}: AtItemProps) {
	// 判断是否在消息列表中：消息列表中不会传递 onRemove
	const isInMessageList = !onRemove

	const [isHovered, setIsHovered] = useState(false)
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")

	const displayName = getMentionDisplayName(data)
	const icon = getMentionIcon(data)
	const description = getMentionDescription(data)

	// 检查是否为上传文件且有上传进度
	const isUploadFile = data.type === MentionItemType.UPLOAD_FILE
	const uploadData = isUploadFile ? (data.data as UploadFileMentionData) : null
	const hasProgress =
		uploadData?.upload_progress !== undefined && uploadData?.upload_status === "uploading"
	const progress = uploadData?.upload_progress || 0
	const isUploadError = uploadData?.upload_status === "error"

	const handleClick = (item: TiptapMentionAttributes) => {
		if (!onFileClick) {
			if (item.type === MentionItemType.PROJECT_FILE) {
				const data = item.data as ProjectFileMentionData
				const fileName = data.file_name

				const extension = data.file_extension || data.file_name.split(".").pop() || ""
				const type = getFileType(extension)

				if (type === "image" && isMobile) {
					showMobileImagePreview({
						alt: fileName,
						file_id: data.file_id,
					})
					return
				}
			} else if (item.type === MentionItemType.UPLOAD_FILE) {
				const data = item.data as UploadFileMentionData
				const file = data.file
				const fileExtension = data.file_extension || file?.type.split("/").pop() || ""
				if (file && getFileType(fileExtension) === "image") {
					showMobileImagePreview({
						alt: data.file_name,
						file: data.file,
					})
					return
				}
			}

			return
		}

		switch (item.type) {
			case MentionItemType.PROJECT_FILE:
				// const result = handleProjectFileMention(item.data as ProjectFileMentionData, t)
				onFileClick?.(item.data)
				break
			default:
				break
		}
	}

	const handleRemove = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			onRemove?.(data)
		},
		[data, onRemove],
	)

	if (data.type === MentionItemType.DESIGN_MARKER) {
		return (
			<MarkerAtItem
				data={data}
				onRemove={onRemove}
				className={className}
				flag={flag}
				iconSize={iconSize}
				markerTooltipProps={markerTooltipProps}
				markerClickScene={markerClickScene}
				messageContent={messageContent}
			/>
		)
	}

	const iconRadius = isMobile ? 8 : 4

	// Render icon based on type and hover state
	const renderIcon = () => {
		// Show remove icon when hovered and onRemove is available
		if (isHovered && onRemove && !isMobile) {
			return (
				<div
					className="flex shrink-0 cursor-pointer items-center justify-center"
					onClick={handleRemove}
				>
					<TSIcon type="ts-close-line" size={iconSize.toString()} />
				</div>
			)
		}

		// Show normal icon
		switch (data.type) {
			case MentionItemType.MCP:
				return icon ? (
					<img
						src={icon}
						alt="MCP"
						className="object-cover"
						style={{
							width: iconSize,
							height: iconSize,
							borderRadius: iconRadius,
						}}
					/>
				) : (
					<PlugIcon size={iconSize} />
				)
			case MentionItemType.AGENT:
				return icon ? (
					<img
						src={icon}
						alt="Agent"
						className="object-cover"
						style={{
							width: iconSize,
							height: iconSize,
							borderRadius: iconRadius,
						}}
					/>
				) : (
					<BotIcon size={iconSize} />
				)
			case MentionItemType.SKILL:
				return icon ? (
					<img
						src={icon}
						alt="Skill"
						className="object-cover"
						style={{
							width: iconSize,
							height: iconSize,
							borderRadius: iconRadius,
						}}
					/>
				) : (
					<SkillIcon size={iconSize} />
				)
			case MentionItemType.PROJECT_FILE:
				const item = data.data as ProjectFileMentionData
				const extension = item.file_extension || item.file_name.split(".").pop() || ""
				const type = getFileType(extension)
				if (type === "image" && item.file_id) {
					return (
						<ImageInProjectFile
							fileId={item.file_id}
							fileName={item.file_name}
							size={iconSize}
							fallback={<TSIcon type="ts-image" size={iconSize.toString()} />}
						/>
					)
				}

				return icon ? (
					<MagicFileIcon type={icon as string} size={iconSize} />
				) : (
					<TSIcon type="ts-attachment" size={iconSize.toString()} />
				)
			case MentionItemType.TOOL:
				return icon ? (
					<img
						src={icon}
						alt="Tool"
						className="object-cover"
						style={{
							width: iconSize,
							height: iconSize,
							borderRadius: iconRadius,
						}}
					/>
				) : (
					<ToolIcon size={iconSize} />
				)
			case MentionItemType.UPLOAD_FILE:
				const uploadData = data.data as UploadFileMentionData
				const file = uploadData.file
				const fileExtension = uploadData.file_extension || file?.type.split("/").pop() || ""
				if (file && getFileType(fileExtension) === "image") {
					return (
						<ImageInUploadFile
							file={file}
							fileName={uploadData.file_name}
							size={iconSize}
						/>
					)
				}
				return <MagicFileIcon type={icon as string} size={iconSize} />
			case MentionItemType.FOLDER:
				const directoryMetadata = (data.data as DirectoryMentionData)?.directory_metadata
				if (directoryMetadata?.type) {
					return (
						<MagicFileIcon
							type={getAttachmentType(directoryMetadata) || ""}
							size={iconSize}
						/>
					)
				}
				return (
					<img
						src={FoldIcon}
						alt="file-folder"
						style={{ width: iconSize, height: iconSize }}
					/>
				)
			case MentionItemType.CLOUD_FILE:
			default:
				return (
					<TSIcon
						type={icon as IconParkIconElement["name"]}
						size={iconSize.toString()}
						radius={iconRadius}
					/>
				)
		}
	}

	// Render name prefix
	const renderNamePrefix = () => {
		return null
	}

	const renderNameSuffix = () => {
		return null
	}

	const content = (
		<div
			className={cn(
				"relative flex min-w-[30px] max-w-[160px] shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md border border-border px-1",
				isUploadError ? "border-destructive bg-destructive/10" : "",
				iconSize >= 16 ? "py-1" : "py-0.5",
				className,
			)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onClick={() => handleClick?.(data)}
			data-mention-item={flag}
		>
			{/* Progress bar background */}
			{hasProgress && (
				<div
					className="absolute left-0 top-0 z-0 h-full rounded-l bg-primary-10 transition-[width] duration-300 ease-in-out"
					style={{ width: `${progress}%` }}
				/>
			)}
			<div className="relative z-10 flex w-full flex-1 items-center gap-1">
				<div className="relative flex items-center justify-center">{renderIcon()}</div>
				<span
					className={`flex min-w-0 items-center text-[10px] leading-[13px] text-foreground md:text-xs md:leading-4 ${isUploadError ? "text-destructive" : ""} `}
				>
					{renderNamePrefix()}
					<span className="truncate">{displayName}</span>
					{renderNameSuffix()}
				</span>
				{isUploadError && onRetry && (
					<span
						role="button"
						tabIndex={0}
						className="shrink-0 overflow-hidden text-ellipsis text-[10px] leading-[13px] text-primary md:text-sm md:leading-[18px]"
						onClick={() => {
							if (data.data && onRetry) {
								const fileData = data.data as UploadFileMentionData
								onRetry?.(fileData.file_id)
							}
						}}
					>
						{t("fileUpload.retry")}
					</span>
				)}
				{isMobile && onRemove && (
					<div
						className="flex shrink-0 cursor-pointer items-center justify-center"
						onClick={handleRemove}
					>
						<TSIcon type="ts-close-line" size="16" onClick={handleRemove} />
					</div>
				)}
			</div>
		</div>
	)

	return (
		<MentionTooltipWrapper
			data={data}
			displayName={displayName}
			description={description}
			isInMessageList={isInMessageList}
			placement={placement}
			tooltipProps={tooltipProps}
		>
			{content}
		</MentionTooltipWrapper>
	)
}

export default memo(AtItem)
