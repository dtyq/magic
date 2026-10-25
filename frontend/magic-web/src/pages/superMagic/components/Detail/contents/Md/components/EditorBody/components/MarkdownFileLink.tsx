import {
	createContext,
	useContext,
	useEffect,
	useState,
	type AnchorHTMLAttributes,
	type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"
import { MediaPreviewTrigger } from "@/components/base/MediaPreview"
import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import { isMarkdownFileLink } from "@/pages/superMagic/utils/markdownFileReference"
import { getFileType } from "@/pages/superMagic/utils/handleFIle"
import {
	useFileMediaSource,
	getFileMediaMetadata,
} from "@/pages/superMagic/services/useFileMediaSource"
import { cn } from "@/utils/cn"
import type { ResolveMarkdownLinkedFile } from "../hooks/useMarkdownFileLinks"

export interface MarkdownFileLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	resolveLinkedFile?: ResolveMarkdownLinkedFile
	projectId?: string
	active?: boolean
	allowDownload?: boolean
}

// 两种 renderer 共用当前文档上下文；缓存标签变为隐藏时，已有 mark view 也立即停止预览。
export const MarkdownFileLinkContext = createContext<
	Pick<MarkdownFileLinkProps, "resolveLinkedFile" | "projectId" | "active" | "allowDownload">
>({ active: false })

export function MarkdownFileLink({
	href = "",
	children,
	resolveLinkedFile: providedResolver,
	projectId: providedProjectId,
	active: providedActive,
	allowDownload: providedAllowDownload,
	...props
}: MarkdownFileLinkProps) {
	const context = useContext(MarkdownFileLinkContext)
	const resolveLinkedFile = providedResolver ?? context.resolveLinkedFile
	const projectId = providedProjectId ?? context.projectId
	const active = providedActive ?? context.active ?? false
	const { t } = useTranslation("super")
	const [resolution, setResolution] = useState<{
		href: string
		resolve: ResolveMarkdownLinkedFile
		file: AttachmentItem | undefined
	} | null>(null)
	const isFile = isMarkdownFileLink(href)
	const candidateType = getFileType(href.split("#", 1)[0].split(".").pop() || "")
	const isMedia =
		candidateType === "image" || candidateType === "video" || candidateType === "audio"
	useEffect(() => {
		if (!active || !isFile || !isMedia || !resolveLinkedFile) return
		const controller = new AbortController()
		void resolveLinkedFile(href, controller.signal)
			.then((file) => {
				if (!controller.signal.aborted)
					setResolution({ href, resolve: resolveLinkedFile, file })
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setResolution({ href, resolve: resolveLinkedFile, file: undefined })
			})
		return () => controller.abort()
	}, [active, isFile, isMedia, href, resolveLinkedFile])
	const file =
		active && resolution?.href === href && resolution.resolve === resolveLinkedFile
			? resolution.file
			: undefined
	const fileMetadata = file ? getFileMediaMetadata(file, projectId) : null
	const metadata = fileMetadata
		? { ...fileMetadata, allowDownload: providedAllowDownload ?? context.allowDownload }
		: null
	const source = useFileMediaSource(metadata, { enabled: active })
	const renderLink = (thumbnail: ReactNode) => (
		<a
			{...props}
			href={isFile ? undefined : href || undefined}
			data-file-href={isFile ? href : undefined}
			data-file-title={source ? props.title : undefined}
			role={isFile ? "button" : props.role}
			tabIndex={isFile ? 0 : props.tabIndex}
			title={source ? undefined : props.title}
			className={cn(
				props.className,
				isFile && "cursor-pointer focus-visible:outline",
				source &&
					"inline-flex max-w-full items-baseline gap-1 align-baseline text-[var(--link-text-color)] no-underline [font-size:inherit] [font-weight:inherit] [line-height:inherit]",
			)}
			onKeyDown={(event) => {
				props.onKeyDown?.(event)
				if (
					isFile &&
					!event.defaultPrevented &&
					(event.key === "Enter" || event.key === " ")
				) {
					event.preventDefault()
					event.currentTarget.click()
				}
			}}
		>
			{source ? (
				<>
					<span
						data-file-reference-preview-ui
						contentEditable={false}
						aria-hidden
						// 缩略图只占一个文字图标的位置，正文与表格中的名称仍可自然换行。
						className="inline-flex h-[1lh] w-4 shrink-0 select-none items-center self-start"
					>
						{thumbnail}
					</span>
					{/* 名称独立换行，续行从文字起点开始；保留 mark 内容与搜索高亮。 */}
					<span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">
						{children}
					</span>
				</>
			) : (
				children
			)}
		</a>
	)
	return (
		<MediaPreviewTrigger
			fileName={metadata?.fileName || ""}
			source={source}
			enabled={active}
			fallback={
				file ? (
					<FileResourceIcon presentation={resolveFilePresentation(file)} size={16} />
				) : null
			}
			renderTrigger={renderLink}
			// 编辑器的正文图片样式会覆盖行内尺寸，预览图标明确保持 16px 正方形。
			thumbnailStyle={{ width: 16, height: 16 }}
			enableTouchTrigger={false}
			labels={{
				errorMessage: t("common.fileNotFoundOrLoadFailed"),
				audioLabels: {
					play: t("filePreview.play"),
					pause: t("filePreview.pause"),
					loading: t("common.loading"),
					progress: t("filePreview.progress"),
				},
			}}
		/>
	)
}
