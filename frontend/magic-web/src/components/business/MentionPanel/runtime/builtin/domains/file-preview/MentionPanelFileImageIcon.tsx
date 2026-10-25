import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/utils/cn"
import type { MentionItemRendererContext } from "../../../../renderers/types"
import {
	MentionItemType,
	type ProjectFileMentionData,
	type UploadFileMentionData,
} from "../../../../types"
import {
	getMentionProjectFileImageExtension,
	isMentionPanelImageFileExtension,
} from "./preview-utils"
import { getCanvasElementSourcePreview } from "../canvas-elements/item-utils"
import { CanvasElementResourceIcon } from "../canvas-elements/CanvasElementResourceIcon"
import { MentionFileImagePreviewBox } from "./MentionFileImagePreviewBox"

function getFileRowIconSize(platform: MentionItemRendererContext["platform"]) {
	return platform === "desktop" ? 16 : 20
}

function getMagicFileIconType(context: MentionItemRendererContext): string {
	const { item } = context
	if (typeof item.icon === "string" && item.icon) return item.icon

	const fromData = (item.data as ProjectFileMentionData | UploadFileMentionData | undefined)
		?.file_extension
	if (fromData) return fromData

	return ""
}

type ImageLoadPhase = "loading" | "loaded" | "error"

export function MentionPanelFileImageIcon(props: {
	context: MentionItemRendererContext
	/** 行内图标沿用平台默认尺寸；已选缩略图等复合入口可显式放大。 */
	iconSize?: number
	/** 行内预览默认裁切填满；完整缩略图场景可改为 contain。 */
	imageFit?: "cover" | "contain"
}) {
	const { context, iconSize = getFileRowIconSize(context.platform), imageFit = "cover" } = props
	const canvasElementPreview = getCanvasElementSourcePreview(context.item)
	if (canvasElementPreview) {
		return <CanvasElementResourceIcon preview={canvasElementPreview} iconSize={iconSize} />
	}

	return (
		<ProjectMentionPanelFileImageIcon
			context={context}
			iconSize={iconSize}
			imageFit={imageFit}
		/>
	)
}

function ProjectMentionPanelFileImageIcon(props: {
	context: MentionItemRendererContext
	iconSize: number
	imageFit: "cover" | "contain"
}) {
	const { context, iconSize, imageFit } = props
	const { item, filePreviewById } = context

	const extension =
		item.type === MentionItemType.PROJECT_FILE
			? getMentionProjectFileImageExtension(item)
			: item.extension ||
				(item.data as UploadFileMentionData | undefined)?.file_extension ||
				(typeof item.icon === "string" && !item.icon.startsWith("ts-") ? item.icon : "")

	const projectData =
		item.type === MentionItemType.PROJECT_FILE
			? (item.data as ProjectFileMentionData | undefined)
			: undefined
	const uploadData =
		item.type === MentionItemType.UPLOAD_FILE
			? (item.data as UploadFileMentionData | undefined)
			: undefined

	const resolvedProjectPreview = projectData?.file_id
		? filePreviewById?.[projectData.file_id]
		: undefined

	const uploadFile = uploadData?.file
	const objectUrl = useMemo(() => {
		if (resolvedProjectPreview) return undefined
		if (!uploadFile) return undefined

		const ext = uploadData?.file_extension || uploadFile.name
		if (!isMentionPanelImageFileExtension(ext)) return undefined

		return URL.createObjectURL(uploadFile)
	}, [resolvedProjectPreview, uploadData?.file_extension, uploadFile])

	useEffect(() => {
		if (!objectUrl) return
		return () => URL.revokeObjectURL(objectUrl)
	}, [objectUrl])

	const resolvedPreviewUrl = resolvedProjectPreview || objectUrl
	const [imagePhase, setImagePhase] = useState<ImageLoadPhase>("loading")
	const previewWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isImageExtension = isMentionPanelImageFileExtension(extension)

	useEffect(() => {
		if (previewWaitTimeoutRef.current) {
			clearTimeout(previewWaitTimeoutRef.current)
			previewWaitTimeoutRef.current = null
		}

		if (!isImageExtension) {
			setImagePhase("error")
			return
		}

		setImagePhase("loading")

		if (resolvedPreviewUrl) {
			return
		}

		previewWaitTimeoutRef.current = setTimeout(() => {
			setImagePhase("error")
			previewWaitTimeoutRef.current = null
		}, 1500)

		return () => {
			if (previewWaitTimeoutRef.current) {
				clearTimeout(previewWaitTimeoutRef.current)
				previewWaitTimeoutRef.current = null
			}
		}
	}, [isImageExtension, resolvedPreviewUrl])

	const data = projectData ?? uploadData
	const presentation = resolveFilePresentation(
		{
			...data,
			file_name: data?.file_name ?? item.name,
			relative_file_path: projectData?.relative_file_path ?? projectData?.file_path,
			file_extension: extension || getMagicFileIconType(context),
			display_config: item.displayConfig,
			parent_id: item.parentId,
		},
		context.filePresentationOptions,
	)
	if (!isImageExtension || imagePhase === "error")
		return <FileResourceIcon presentation={presentation} size={iconSize} />

	if (!resolvedPreviewUrl) {
		return (
			<MentionFileImagePreviewBox iconSize={iconSize}>
				<div
					className={cn(
						"h-full w-full rounded bg-muted",
						"animate-pulse motion-reduce:animate-none",
					)}
				/>
			</MentionFileImagePreviewBox>
		)
	}

	if (imagePhase === "loaded") {
		return (
			<MentionFileImagePreviewBox iconSize={iconSize}>
				<img
					src={resolvedPreviewUrl}
					alt=""
					className="block h-full w-full"
					style={{ objectFit: imageFit }}
					loading="lazy"
					decoding="async"
					referrerPolicy="no-referrer"
				/>
			</MentionFileImagePreviewBox>
		)
	}

	return (
		<MentionFileImagePreviewBox iconSize={iconSize}>
			<div
				className={cn(
					"absolute inset-0 rounded bg-muted",
					"animate-pulse motion-reduce:animate-none",
				)}
			/>
			<img
				src={resolvedPreviewUrl}
				alt=""
				className="absolute inset-0 z-[1] h-full w-full opacity-0"
				style={{ objectFit: imageFit }}
				loading="lazy"
				decoding="async"
				referrerPolicy="no-referrer"
				onLoad={() => setImagePhase("loaded")}
				onError={() => setImagePhase("error")}
			/>
		</MentionFileImagePreviewBox>
	)
}
