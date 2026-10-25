import { FileResourceIcon } from "@/pages/superMagic/components/TopicFilesButton/components/FileResourceIcon"
import { resolveFilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import type { FilePresentation } from "@/pages/superMagic/components/TopicFilesButton/utils/file-presentation"
import type { ReactNode, MouseEvent } from "react"
import { Loader2 } from "lucide-react"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MediaPreviewTrigger } from "@/components/base/MediaPreview"
import { useTranslation } from "react-i18next"
import {
	useFileMediaSource,
	type FileMediaMetadata,
} from "@/pages/superMagic/services/useFileMediaSource"

export interface FileReferenceProps {
	presentation?: FilePresentation
	label: ReactNode
	href?: string
	fileType?: string
	title?: string
	disabled?: boolean
	loading?: boolean
	isDirectory?: boolean
	mentionAttrs?: TiptapMentionAttributes
	mediaFile?: FileMediaMetadata | null
	onClick?: (event: MouseEvent<HTMLSpanElement>) => void
}

export function getFileExtensionFromPath(path: string): string {
	const fileName = path.split(/[\\/]/).pop() || ""
	const extension = fileName.split(".").pop()
	return extension && extension !== fileName ? extension : ""
}

export function FileReference({
	presentation,
	label,
	href,
	fileType,
	title,
	disabled = false,
	loading = false,
	isDirectory = false,
	mentionAttrs,
	mediaFile,
	onClick,
}: FileReferenceProps) {
	const canDrag = !disabled && Boolean(mentionAttrs)
	const { t } = useTranslation("super")
	const source = useFileMediaSource(mediaFile, { enabled: !disabled && !loading && !isDirectory })
	const icon = loading ? (
		<Loader2 size={16} className="shrink-0 animate-spin" />
	) : (
		<FileResourceIcon
			presentation={
				presentation ??
				resolveFilePresentation({
					file_extension: fileType,
					is_directory: isDirectory,
				})
			}
			size={16}
			className="shrink-0"
		/>
	)
	const renderReference = (thumbnail: ReactNode) => (
		<span
			data-testid="markdown-file-reference"
			data-file-reference={href}
			draggable={false}
			data-magic-editor-node={canDrag || undefined}
			data-magic-node-type={mentionAttrs ? "mention" : undefined}
			data-magic-node-attrs={mentionAttrs ? JSON.stringify(mentionAttrs) : undefined}
			aria-disabled={disabled || undefined}
			aria-busy={loading || undefined}
			// Use the filename's baseline for surrounding text; the icon must not supply the flex baseline.
			// 媒体名称略小于正文，外间距分开连续引用；最大宽度扣除外间距，避免窄列溢出。
			className={[
				"inline-flex items-baseline gap-1 overflow-hidden align-baseline",
				source
					? "m-0.5 max-w-[calc(100%-0.25rem)] rounded bg-[#f0f6ff] px-1 text-[#315cec] leading-[1.4] [font-size:0.93em] [font-weight:inherit]"
					: "max-w-full rounded bg-[#f0f6ff] px-0.5 text-xs font-normal text-[#315cec]",
				disabled
					? "cursor-default opacity-60"
					: onClick
						? source
							? "cursor-pointer hover:bg-[#e0ecff]"
							: "cursor-pointer hover:bg-[#e0ecff]"
						: "",
			].join(" ")}
			title={source ? undefined : title}
			onClick={disabled ? undefined : onClick}
			role={onClick ? "button" : undefined}
			tabIndex={!disabled && onClick ? 0 : undefined}
			onKeyDown={(event) => {
				if (!disabled && onClick && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault()
					event.currentTarget.click()
				}
			}}
		>
			<span
				className={
					source
						? "inline-flex size-4 shrink-0 items-center self-center"
						: "mt-[-0.2em] shrink-0 self-center"
				}
				aria-hidden
			>
				{thumbnail}
			</span>
			<span
				data-file-reference-label
				className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
			>
				{label}
			</span>
		</span>
	)
	return (
		<MediaPreviewTrigger
			fileName={mediaFile?.fileName || title || href || ""}
			source={source}
			fallback={icon}
			renderTrigger={renderReference}
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
