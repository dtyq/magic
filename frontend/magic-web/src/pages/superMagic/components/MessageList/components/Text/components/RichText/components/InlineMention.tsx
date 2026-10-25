import { observer } from "mobx-react-lite"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { memo, useCallback, type MouseEvent } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import TSIcon from "@/components/base/TSIcon"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	getMentionDescription,
	getMentionDisplayName,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import {
	DirectoryMentionData,
	MentionItemType,
	type MicroAppMentionData,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import { showMobileImagePreview } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MobileImagePreview"
import MentionMediaIcon from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MentionMediaIcon"
import {
	DEFAULT_FILE_MENTION_RENDER_CONFIG,
	getFileMentionRenderType,
	isFileMentionFeatureEnabled,
	type FileMentionRenderConfig,
} from "@/pages/superMagic/components/MessageEditor/components/MentionMedia/fileMentionRenderConfig"
import { useMentionMediaSource } from "@/pages/superMagic/components/MessageEditor/components/MentionMedia/useMentionMediaSource"
import { useMarkerImageUrl } from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useMarkerImageUrl"
import { useTransformedMarkerData } from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/useTransformedMarkerData"
import { MentionTooltipWrapper } from "@/pages/superMagic/components/MessageEditor/components/AtItem/components/MentionTooltipWrapper"
import MarkerAtItem from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/marker/MarkerAtItem"
import {
	type MarkerClickScene,
	useMarkerClickHandler,
} from "@/pages/superMagic/components/MessageEditor/hooks/useMarkerClickHandler"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import { getCanvasMarkerMentionImagePath } from "@/components/business/MentionPanel/utils/canvasMarkerMention"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import { needsFileReferenceNormalization } from "@/components/business/MentionPanel/utils/fileReferenceMention"
import { UserFileReference } from "@/pages/superMagic/components/MessageList/components/Text/components/Markdown/parser/UserFileReference"
import { createUserFileHref } from "@/pages/superMagic/utils/markdownFileReference"
import { ProjectDirectoryMentionIcon } from "@/pages/superMagic/components/MessageEditor/components/MentionNodes/folder/ProjectDirectoryMentionIcon"
import {
	FileReference,
	getFileExtensionFromPath,
} from "@/pages/superMagic/components/MessageList/components/Text/components/Markdown/parser/FileReference"
import { openMicroAppTab } from "@/pages/superMagic/components/MessageList/utils/openMicroAppTab"

interface InlineMentionProps {
	data: TiptapMentionAttributes
	onFileClick?: (item: TiptapMentionAttributes["data"]) => void
	markerClickScene?: MarkerClickScene
	messageContent?: JSONContent | string | Record<string, unknown>
	projectFilesStore?: ProjectFilesStore
	fileMentionRenderConfig?: FileMentionRenderConfig
}

function InlineMarkerMention(props: InlineMentionProps) {
	const { data, markerClickScene = "messageList", messageContent, projectFilesStore } = props

	return (
		<span
			className="magic-marker-mention inline-flex cursor-grab select-none align-bottom active:cursor-grabbing"
			draggable={false}
			data-magic-editor-node
			data-magic-node-type="mention"
			data-magic-node-attrs={JSON.stringify(data)}
		>
			<MarkerAtItem
				data={data}
				markerClickScene={markerClickScene}
				messageContent={messageContent}
				projectFilesStore={projectFilesStore}
			/>
		</span>
	)
}

const InlineDefaultMention = observer(function InlineDefaultMention(props: InlineMentionProps) {
	const {
		data,
		onFileClick,
		markerClickScene = "messageList",
		messageContent,
		projectFilesStore,
		fileMentionRenderConfig = DEFAULT_FILE_MENTION_RENDER_CONFIG,
	} = props

	const isMobile = useIsMobile()
	const displayName = getMentionDisplayName(data)
	const description = getMentionDescription(data)
	const isInMessageList = true
	const isFileMention =
		data.type === MentionItemType.PROJECT_FILE || data.type === MentionItemType.UPLOAD_FILE
	const fileData = isFileMention
		? (data.data as ProjectFileMentionData | UploadFileMentionData)
		: null
	const presentation = fileData
		? resolveFilePresentation(fileData, {
				context: projectFilesStore?.filePresentationContext,
				index: projectFilesStore?.filePresentationIndex,
			})
		: undefined
	const mediaSource = useMentionMediaSource({
		data,
		uploadFile:
			data.type === MentionItemType.UPLOAD_FILE
				? (data.data as UploadFileMentionData).file
				: null,
	})
	const shouldRenderIcon =
		isFileMention &&
		isFileMentionFeatureEnabled(
			"icon",
			getFileMentionRenderType(mediaSource.mediaType),
			fileMentionRenderConfig,
		)

	const { markerData: transformedMarkerData, loading: markerLoading } = useTransformedMarkerData(
		data,
		isInMessageList,
		projectFilesStore,
	)
	const { imageUrl: markerImageUrl } = useMarkerImageUrl(
		transformedMarkerData ? getCanvasMarkerMentionImagePath(transformedMarkerData) : undefined,
		transformedMarkerData?.design_project_id,
		projectFilesStore,
	)
	const { handleMarkerClick } = useMarkerClickHandler({
		scene: markerClickScene,
		disabled: markerClickScene === "draftBox",
		transformedMarkerData,
		messageContent,
	})

	const handleClick = useCallback(
		(event: MouseEvent<HTMLSpanElement>) => {
			event.preventDefault()
			event.stopPropagation()

			if (data.type === MentionItemType.DESIGN_MARKER) {
				handleMarkerClick(data)
				return
			}

			if (data.type === MentionItemType.MICRO_APP) {
				const mentionData = data.data as MicroAppMentionData
				openMicroAppTab({
					appId: mentionData?.app_id,
					appName: mentionData?.app_name,
				})
				return
			}

			if (!onFileClick) {
				if (data.type === MentionItemType.PROJECT_FILE && isMobile) {
					const fileData = data.data as ProjectFileMentionData
					const extension =
						fileData.file_extension || fileData.file_name.split(".").pop() || ""

					if (fileData.file_id && getFileType(extension) === "image") {
						showMobileImagePreview({
							alt: fileData.file_name,
							file_id: fileData.file_id,
						})
					}
				}

				if (data.type === MentionItemType.UPLOAD_FILE && isMobile) {
					const fileData = data.data as UploadFileMentionData
					const file = fileData.file
					const fileExtension =
						fileData.file_extension || file?.type.split("/").pop() || ""

					if (file && getFileType(fileExtension) === "image") {
						showMobileImagePreview({
							alt: fileData.file_name,
							file,
						})
					}
				}

				return
			}

			if (data.type === MentionItemType.PROJECT_FILE) {
				onFileClick(data.data)
			}

			if (
				data.type === MentionItemType.FOLDER &&
				(data.data as DirectoryMentionData)?.directory_metadata
			) {
				onFileClick({
					file_id: (data.data as DirectoryMentionData)?.directory_id,
				})
			}
		},
		[data, handleMarkerClick, isMobile, onFileClick],
	)

	const isDirectory =
		data.type === MentionItemType.FOLDER || data.type === MentionItemType.MEMORY_DIRECTORY
	const label = `@${displayName}`
	const filePath =
		fileData?.relative_file_path || fileData?.file_path || fileData?.file_name || ""
	const fileLabel = fileData?.file_name || displayName
	// 历史消息可能没存 project_id；只补来源项目，不能用接收输入框的项目替代。
	const projectData =
		data.type === MentionItemType.PROJECT_FILE || data.type === MentionItemType.FOLDER
			? (data.data as ProjectFileMentionData | DirectoryMentionData)
			: null
	const dragAttrs = projectData
		? {
				...data,
				data: {
					...projectData,
					project_id:
						projectData.project_id ||
						projectData.source_project_id ||
						projectFilesStore?.currentSelectedProject?.id,
				},
			}
		: data
	const dragSourceProps = {
		draggable: false as const,
		"data-magic-editor-node": true as const,
		"data-magic-node-type": "mention",
		"data-magic-node-attrs": JSON.stringify(dragAttrs),
	}
	const fileVisual = isFileMention ? (
		shouldRenderIcon && fileData ? (
			<span
				className={cn(
					"magic-mention select-none",
					"!inline-flex items-center gap-1 !align-middle",
				)}
				data-type={data.type}
				data-data={JSON.stringify(data.data)}
				{...dragSourceProps}
				onMouseDown={(event) => event.preventDefault()}
				onClick={handleClick}
			>
				<span className="flex shrink-0 items-center" data-testid="inline-file-mention-icon">
					<MentionMediaIcon
						presentation={presentation}
						type={
							data.type as
								| typeof MentionItemType.PROJECT_FILE
								| typeof MentionItemType.UPLOAD_FILE
						}
						data={fileData}
						size={16}
						mediaSource={mediaSource}
					/>
				</span>
				<span className="min-w-0 truncate" title={fileLabel}>
					{fileLabel}
				</span>
			</span>
		) : (
			<span
				className="magic-mention !inline-flex max-w-full select-none !overflow-visible !rounded-none !bg-transparent !p-0 !align-middle"
				data-type={data.type}
				data-data={JSON.stringify(data.data)}
				{...dragSourceProps}
				onMouseDown={(event) => event.preventDefault()}
			>
				<FileReference
					presentation={presentation}
					label={fileLabel}
					fileType={fileData?.file_extension || getFileExtensionFromPath(filePath)}
					title={fileLabel}
					onClick={handleClick}
				/>
			</span>
		)
	) : isDirectory ? (
		<span
			className="magic-mention !inline-flex select-none items-center gap-1 !align-middle"
			data-type={data.type}
			data-data={JSON.stringify(data.data)}
			{...dragSourceProps}
			onMouseDown={(event) => event.preventDefault()}
			onClick={handleClick}
		>
			{data.type === MentionItemType.FOLDER ? (
				<ProjectDirectoryMentionIcon
					context={projectFilesStore?.filePresentationContext}
					data={data.data as DirectoryMentionData}
					workspaceFilesList={projectFilesStore?.workspaceFilesList ?? []}
					size={16}
				/>
			) : (
				<TSIcon type="ts-folder" size="16" className="shrink-0" />
			)}
			<span className="min-w-0 truncate" title={displayName}>
				{displayName}
			</span>
		</span>
	) : (
		<span
			className="magic-mention select-none"
			data-type={data.type}
			data-data={JSON.stringify(data.data)}
			{...dragSourceProps}
			onMouseDown={(event) => event.preventDefault()}
			onClick={handleClick}
		>
			{label}
		</span>
	)

	return (
		<MentionTooltipWrapper
			data={data}
			displayName={displayName}
			description={description}
			isInMessageList={isInMessageList}
			transformedMarkerData={transformedMarkerData}
			markerLoading={markerLoading}
			markerImageUrl={markerImageUrl}
			mediaSource={mediaSource}
			fileMentionRenderConfig={fileMentionRenderConfig}
		>
			{fileVisual}
		</MentionTooltipWrapper>
	)
})

function InlineMention(props: InlineMentionProps) {
	if (needsFileReferenceNormalization(props.data)) {
		const data = props.data.data as Record<string, unknown> | undefined
		const id = String(data?.file_id || data?.directory_id || "")
		const path = String(data?.file_path || data?.directory_path || "")
		return (
			<UserFileReference
				selector={{ file_id: id }}
				mentionAttrs={props.data}
				label={String(data?.file_name || data?.directory_name || "")}
				href={
					path.startsWith("~/")
						? createUserFileHref(path, Boolean(data?.directory_id)) || undefined
						: undefined
				}
			/>
		)
	}
	if (props.data.type === MentionItemType.DESIGN_MARKER) {
		return <InlineMarkerMention {...props} />
	}

	return <InlineDefaultMention {...props} />
}

export default memo(InlineMention)
