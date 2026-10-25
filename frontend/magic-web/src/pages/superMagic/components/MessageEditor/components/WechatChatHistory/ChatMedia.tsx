import { useRef } from "react"
import { useInViewport } from "ahooks"
import { File, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { UploadFileMentionData } from "@/components/business/MentionPanel/types"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import { Button } from "@/components/shadcn-ui/button"
import { MediaPreviewTrigger } from "@/components/base/MediaPreview"
import type { FileData } from "../../types"
import { useMentionMediaSource } from "../MentionMedia/useMentionMediaSource"

export default function ChatMedia({
	attrs,
	files,
	onRetry,
}: {
	attrs: TiptapMentionAttributes
	files: FileData[]
	onRetry: (id: string) => void
}) {
	const { t } = useTranslation("super")
	const data = attrs.data as UploadFileMentionData
	// local id 与远端 id 均来自同一上传记录；重名附件绝不参与关联。
	const upload = files.find(
		(file) =>
			Boolean(data.file_id) &&
			(file.id === data.file_id ||
				file.saveResult?.file_id === data.file_id ||
				file.reportResult?.file_id === data.file_id),
	)
	const container = useRef<HTMLDivElement>(null)
	const [visible] = useInViewport(container)
	const liveFile =
		upload && !upload.isVirtualReference && upload.file.size > 0 ? upload.file : null
	const remoteId =
		upload?.saveResult?.file_id ||
		upload?.reportResult?.file_id ||
		(data.upload_status === "done" ? data.file_id : undefined)
	// 虚拟引用的空 File 不是媒体字节。当前队列有真实字节时优先本地；恢复后的完成引用按真实远端身份读取。
	const mediaAttrs: TiptapMentionAttributes = liveFile
		? { ...attrs, type: MentionItemType.UPLOAD_FILE }
		: attrs.type === MentionItemType.UPLOAD_FILE && remoteId && data.upload_status === "done"
			? {
					...attrs,
					type: MentionItemType.PROJECT_FILE,
					data: {
						...data,
						file_id: remoteId,
						project_id: upload?.saveResult?.project_id,
					},
				}
			: attrs
	const media = useMentionMediaSource({
		data: mediaAttrs,
		uploadFile: liveFile,
		enabled: visible === true,
	})
	const fallback = (
		<div className="flex items-center gap-3 p-3 text-sm">
			<File className="size-4 shrink-0" />
			<span className="break-all">{data.file_name}</span>
		</div>
	)
	return (
		<div ref={container} className="max-w-80 rounded-lg bg-muted p-2">
			{media.isLoading ? (
				<div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					{t("wechatChat.mediaLoading")}
				</div>
			) : media.hasError ? (
				<div className="p-3 text-xs text-muted-foreground">
					{t("wechatChat.mediaLoadFailed")}
				</div>
			) : (
				<MediaPreviewTrigger
					fileName={data.file_name}
					source={media.mediaType ? { ...media, mediaType: media.mediaType } : null}
					fallback={fallback}
					thumbnailClassName="max-h-80 max-w-full rounded object-contain"
					labels={{
						errorMessage: t("wechatChat.mediaLoadFailed"),
						audioLabels: {
							play: t("wechatChat.play"),
							pause: t("wechatChat.pause"),
							progress: t("wechatChat.playbackProgress"),
						},
					}}
					renderTrigger={(thumbnail) => (
						<button
							type="button"
							className="block max-w-full text-left"
							aria-label={t("wechatChat.previewAttachment", { name: data.file_name })}
						>
							{thumbnail}
						</button>
					)}
				/>
			)}
			{upload?.status === "error" ? (
				<div className="mt-2 flex items-center gap-2 text-xs text-destructive">
					<span>{upload.error || t("wechatChat.uploadFailed")}</span>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onRetry(upload.id)}
					>
						{t("wechatChat.retry")}
					</Button>
				</div>
			) : upload && upload.status !== "done" ? (
				<p className="mt-2 text-xs text-muted-foreground">
					{t("wechatChat.uploading", { progress: Math.round(upload.progress ?? 0) })}
				</p>
			) : null}
		</div>
	)
}
