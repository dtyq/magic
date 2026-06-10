import { useEffect, useMemo, useRef, useState } from "react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { cn } from "@/lib/utils"
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
import projectFilesStore from "@/stores/projectFiles"
import { CustomFolderMagicIcon } from "@/pages/superMagic/components/TopicFilesButton/components/CustomFolderMagicIcon"
import {
	getFileTreeIconType,
	type MagicProjectIconContext,
} from "@/pages/superMagic/components/MessageList/components/MessageAttachment/utils"

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

export function MentionPanelFileImageIcon(props: { context: MentionItemRendererContext }) {
	const { context } = props
	const { item, platform, filePreviewById } = context
	const iconSize = getFileRowIconSize(platform)

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

	if (!isImageExtension) {
		// Normalize path for comparison (remove leading slash)
		const normalizePath = (path: string) => {
			return path.startsWith("/") ? path.slice(1) : path
		}

		// Try to find file data from store if not in item
		let fileDisplayConfig = item.displayConfig
		let parentId = item.parentId
		const fileData = item.data as ProjectFileMentionData | undefined
		let fileIconSource: MagicProjectIconContext = {
			...fileData,
			name: item.name,
			file_extension: fileData?.file_extension || (item.icon as string),
			display_config: fileDisplayConfig,
		}

		if (!fileDisplayConfig || !parentId) {
			const fileNode = projectFilesStore.workspaceFilesList.find((f) => {
				if (fileData?.file_id) {
					return f.file_id === fileData.file_id
				}
				if (fileData?.file_path) {
					return (
						normalizePath(f.relative_file_path || "") ===
						normalizePath(fileData.file_path || "")
					)
				}
				return false
			})

			if (fileNode) {
				fileDisplayConfig = fileNode.display_config
				parentId = fileNode.parent_id || undefined
				fileIconSource = fileNode
			}
		}

		if (
			fileDisplayConfig?.type === "custom" ||
			(fileDisplayConfig?.type === "micro-app" && (item as any)?.is_directory)
		) {
			// 优先使用 _customFolderId（入口文件需从原始 custom 文件夹解析 icon_path）
			const customFolderId = (fileDisplayConfig as any)?._customFolderId
			const targetFolderId = customFolderId || parentId

			const targetNode = targetFolderId
				? projectFilesStore.getFolderData(targetFolderId)
				: null
			const childrenItems = (targetNode?.children as unknown[]) || []

			return (
				<CustomFolderMagicIcon
					displayConfig={fileDisplayConfig}
					childrenItems={childrenItems}
					size={iconSize}
					typeFallback="custom"
				/>
			)
		}

		const iconType = getFileTreeIconType(fileIconSource)
		return <MagicFileIcon type={iconType || (item.icon as string)} size={iconSize} />
	}

	if (imagePhase === "error") {
		return <MagicFileIcon type={getMagicFileIconType(context)} size={iconSize} />
	}

	if (!resolvedPreviewUrl) {
		return (
			<div className="relative shrink-0" style={{ width: iconSize, height: iconSize }}>
				<div
					className={cn(
						"h-full w-full rounded bg-muted",
						"animate-pulse motion-reduce:animate-none",
					)}
				/>
			</div>
		)
	}

	if (imagePhase === "loaded") {
		return (
			<img
				src={resolvedPreviewUrl}
				alt=""
				width={iconSize}
				height={iconSize}
				className={cn("shrink-0 rounded object-cover")}
				loading="lazy"
				decoding="async"
				referrerPolicy="no-referrer"
			/>
		)
	}

	return (
		<div className="relative shrink-0" style={{ width: iconSize, height: iconSize }}>
			<div
				className={cn(
					"absolute inset-0 rounded bg-muted",
					"animate-pulse motion-reduce:animate-none",
				)}
			/>
			<img
				src={resolvedPreviewUrl}
				alt=""
				width={iconSize}
				height={iconSize}
				className={cn("relative z-[1] shrink-0 rounded object-cover opacity-0")}
				loading="lazy"
				decoding="async"
				referrerPolicy="no-referrer"
				onLoad={() => setImagePhase("loaded")}
				onError={() => setImagePhase("error")}
			/>
		</div>
	)
}
