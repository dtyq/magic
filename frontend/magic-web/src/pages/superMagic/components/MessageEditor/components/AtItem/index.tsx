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
	UserFileMentionData,
	UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { type TooltipProps } from "antd"
import { memo, useState, useCallback } from "react"
import { showMobileImagePreview } from "./components/MobileImagePreview"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useTranslation } from "react-i18next"
import {
	getAttachmentType,
	getFileTreeIconType,
} from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"
import { CustomFolderMagicIcon } from "@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon"
import projectFilesStore from "@/stores/projectFiles"
import { cn } from "@/utils/cn"
import { MentionTooltipWrapper } from "./components/MentionTooltipWrapper"
import MentionMediaIcon from "./components/MentionMediaIcon"
import { useMentionMediaSource } from "../MentionMedia/useMentionMediaSource"
import {
	DEFAULT_FILE_MENTION_RENDER_CONFIG,
	getFileMentionRenderType,
	isFileMentionFeatureEnabled,
	type FileMentionRenderConfig,
} from "../MentionMedia/fileMentionRenderConfig"
import { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { type MarkerClickScene } from "../../hooks/useMarkerClickHandler"
import MarkerAtItem from "../MentionNodes/marker/MarkerAtItem"
import { observer } from "mobx-react-lite"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "@/pages/superMagic/services/userFileReferenceResolver"
import { openUserFileReference } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import magicToast from "@/components/base/MagicToaster/utils"

interface AtItemProps {
	data: TiptapMentionAttributes
	onRemove?: (data: TiptapMentionAttributes) => void
	className?: string
	labelClassName?: string
	retryClassName?: string
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
	/** 消息列表作用域内的附件 store；未传时保持全局 store 行为 */
	projectFilesStore?: ProjectFilesStore
	/** 控制所有文件 Mention 的 Icon 与 Tooltip 展示类型。 */
	fileMentionRenderConfig?: FileMentionRenderConfig
}

function AtItem({
	data,
	onRemove,
	className,
	labelClassName,
	retryClassName,
	onFileClick,
	placement,
	flag,
	onRetry,
	iconSize = 20,
	tooltipProps,
	markerTooltipProps,
	markerClickScene,
	messageContent,
	projectFilesStore: projectFilesStoreInstance,
	fileMentionRenderConfig = DEFAULT_FILE_MENTION_RENDER_CONFIG,
}: AtItemProps) {
	// 判断是否在消息列表中：消息列表中不会传递 onRemove
	const isInMessageList = !onRemove

	const [isHovered, setIsHovered] = useState(false)
	const isMobile = useIsMobile()
	const { t } = useTranslation("super")

	const displayName = getMentionDisplayName(data)
	const icon = getMentionIcon(data)
	const description = getMentionDescription(data)
	const mentionMediaSource = useMentionMediaSource({
		data,
		uploadFile:
			data.type === MentionItemType.UPLOAD_FILE
				? (data.data as UploadFileMentionData).file
				: null,
		enabled: true,
	})

	// 检查是否为上传文件且有上传进度
	const isUploadFile = data.type === MentionItemType.UPLOAD_FILE
	const uploadData = isUploadFile ? (data.data as UploadFileMentionData) : null
	const hasProgress =
		uploadData?.upload_progress !== undefined && uploadData?.upload_status === "uploading"
	const progress = uploadData?.upload_progress || 0
	const isUploadError = uploadData?.upload_status === "error"

	const handleClick = (item: TiptapMentionAttributes) => {
		if (item.type === MentionItemType.USER_FILE) {
			const identity = getFileReferenceIdentityKey()
			void resolveFileReference({ file_id: (item.data as UserFileMentionData).file_id })
				.then((result) => {
					if (identity !== getFileReferenceIdentityKey()) return
					if (result.status === "resolved" && result.reference.space_type === "user")
						openUserFileReference(result.reference)
					else magicToast.error(t("common.fileNotFoundOrLoadFailed"))
				})
				.catch(() => {
					if (identity === getFileReferenceIdentityKey())
						magicToast.error(t("common.fileNotFoundOrLoadFailed"))
				})
			return
		}
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
				if (isMobile && file && getFileType(fileExtension) === "image") {
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
			case MentionItemType.PROJECT_FILE: {
				// const result = handleProjectFileMention(item.data as ProjectFileMentionData, t)
				onFileClick?.(item.data)
				break
			}
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
				projectFilesStore={projectFilesStoreInstance}
			/>
		)
	}

	const iconRadius = isMobile ? 8 : 4

	// Normalize path for comparison (remove leading slash)
	const normalizePath = (path: string) => {
		return path.startsWith("/") ? path.slice(1) : path
	}

	// Render icon based on type and hover state
	const renderIcon = () => {
		// Show remove icon when hovered and onRemove is available
		if (isHovered && onRemove && !isMobile) {
			return (
				<div
					className="flex shrink-0 cursor-pointer items-center justify-center"
					onClick={handleRemove}
					data-testid="handle-remove"
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
						data-testid="at-item-image"
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
						data-testid="at-item-image-2"
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
						data-testid="at-item-image-3"
					/>
				) : (
					<SkillIcon size={iconSize} />
				)
			case MentionItemType.PROJECT_FILE: {
				const item = data.data as ProjectFileMentionData
				const isThumbnailMedia =
					mentionMediaSource.mediaType === "image" ||
					mentionMediaSource.mediaType === "video"
				if (isThumbnailMedia) {
					return (
						<MentionMediaIcon
							type={MentionItemType.PROJECT_FILE}
							data={item}
							size={iconSize}
							mediaSource={mentionMediaSource}
						/>
					)
				}

				const extension = item.file_extension || item.file_name.split(".").pop() || ""
				const fileNode = projectFilesStore.workspaceFilesList.find((f) => {
					if (item.file_id) return f.file_id === item.file_id
					if (item.file_path) {
						return (
							normalizePath(f.relative_file_path || "") ===
							normalizePath(item.file_path || "")
						)
					}
					return false
				})
				const fileDisplayConfig = fileNode?.display_config

				if (fileDisplayConfig?.type === "custom") {
					const customFolderId = (fileDisplayConfig as any)?._customFolderId
					const targetFolderId = customFolderId || fileNode?.parent_id
					const targetNode = targetFolderId
						? projectFilesStore.getFolderData(targetFolderId)
						: null

					return (
						<CustomFolderMagicIcon
							displayConfig={fileDisplayConfig}
							childrenItems={(targetNode?.children as unknown[]) || []}
							size={iconSize}
							typeFallback="custom"
						/>
					)
				}

				return (
					<MagicFileIcon
						type={getFileTreeIconType(
							fileNode || {
								...item,
								display_config: fileDisplayConfig,
								file_extension: extension,
							},
						)}
						size={iconSize}
					/>
				)
			}
			case MentionItemType.MEMORY_FILE:
				return <MagicFileIcon type={icon as string} size={iconSize} />
			case MentionItemType.USER_FILE:
				return (
					<MentionMediaIcon
						type={MentionItemType.USER_FILE}
						data={data.data as UserFileMentionData}
						size={iconSize}
						mediaSource={mentionMediaSource}
					/>
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
						data-testid="at-item-image-4"
					/>
				) : (
					<ToolIcon size={iconSize} />
				)
			case MentionItemType.UPLOAD_FILE: {
				const uploadData = data.data as UploadFileMentionData
				const file = uploadData.file
				const isThumbnailMedia =
					mentionMediaSource.mediaType === "image" ||
					mentionMediaSource.mediaType === "video"
				if (file && isThumbnailMedia) {
					return (
						<MentionMediaIcon
							type={MentionItemType.UPLOAD_FILE}
							data={uploadData}
							size={iconSize}
							mediaSource={mentionMediaSource}
						/>
					)
				}
				return <MagicFileIcon type={icon as string} size={iconSize} />
			}
			case MentionItemType.FOLDER:
				const directoryData = data.data as DirectoryMentionData
				const directoryDisplayConfig = directoryData?.directory_metadata

				if (directoryDisplayConfig?.type === "custom") {
					const folderNode = projectFilesStore.workspaceFilesList.find((f) => {
						if (directoryData.directory_id) {
							return f.file_id === directoryData.directory_id
						}
						if (directoryData.directory_path) {
							return (
								normalizePath(f.relative_file_path || "") ===
								normalizePath(directoryData.directory_path || "")
							)
						}
						return false
					})
					const childrenItems = (folderNode?.children as unknown[]) || []

					return (
						<CustomFolderMagicIcon
							displayConfig={directoryDisplayConfig}
							childrenItems={childrenItems}
							size={iconSize}
							typeFallback="folder"
						/>
					)
				}

				if (directoryDisplayConfig?.type) {
					return (
						<MagicFileIcon
							type={
								getAttachmentType({ display_config: directoryDisplayConfig }) || ""
							}
							size={iconSize}
						/>
					)
				}

				return (
					<img
						src={FoldIcon}
						alt="file-folder"
						style={{ width: iconSize, height: iconSize }}
						data-testid="at-item-image-5"
					/>
				)
			case MentionItemType.MEMORY_DIRECTORY:
			case MentionItemType.USER_DIRECTORY:
				return (
					<img
						src={FoldIcon}
						alt="memory-folder"
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
	const isFileMention =
		data.type === MentionItemType.PROJECT_FILE ||
		data.type === MentionItemType.UPLOAD_FILE ||
		data.type === MentionItemType.USER_FILE
	const fileRenderType = isFileMention
		? getFileMentionRenderType(mentionMediaSource.mediaType)
		: null
	const shouldRenderIcon =
		!isFileMention ||
		isFileMentionFeatureEnabled("icon", fileRenderType ?? "other", fileMentionRenderConfig)
	const renderedIcon = shouldRenderIcon ? renderIcon() : null

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
			data-testid="set-is-hovered"
		>
			{/* Progress bar background */}
			{hasProgress && (
				<div
					className="absolute left-0 top-0 z-0 h-full rounded-l bg-primary-10 transition-[width] duration-300 ease-in-out"
					style={{ width: `${progress}%` }}
				/>
			)}
			<div className="relative z-10 flex w-full flex-1 items-center gap-1">
				{renderedIcon ? (
					<div className="relative flex items-center justify-center">{renderedIcon}</div>
				) : null}
				<span
					className={cn(
						"flex min-w-0 items-center text-[10px] leading-[13px] text-foreground md:text-xs md:leading-4",
						isUploadError && "text-destructive",
						labelClassName,
					)}
				>
					{renderNamePrefix()}
					<span className="truncate">{displayName}</span>
					{renderNameSuffix()}
				</span>
				{isUploadError && onRetry && (
					<span
						role="button"
						tabIndex={0}
						className={cn(
							"shrink-0 overflow-hidden text-ellipsis text-[10px] leading-[13px] text-primary md:text-sm md:leading-[18px]",
							retryClassName,
						)}
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
						data-testid="handle-remove-2"
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
			mediaSource={mentionMediaSource}
			fileMentionRenderConfig={fileMentionRenderConfig}
		>
			{content}
		</MentionTooltipWrapper>
	)
}

export default memo(observer(AtItem))
