import { Clock3 } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import SmartTooltip from "@/components/other/SmartTooltip"
import type { AttachmentLoadState } from "@/stores/projectFiles/types"
import { FileResourceIcon } from "../FileResourceIcon"
import { resolveFilePresentation, type FilePresentationIndex } from "../../utils/file-presentation"
import type { AttachmentItem } from "../../hooks/types"
import { parseFileTime } from "../../hooks/useFileManagerColumns"
import type { FileHelpContext } from "../../utils/magic-system-folder"

const RECENT_FILES_LIMIT = 5

interface RecentFile {
	file: AttachmentItem
	id: string
	updatedAt: number
}

/** 当前项目的共享更新列表；只打开文件不改变更新时间或名单。 */
export function RecentFiles({
	presentationIndex,
	attachmentLoadState,
	context,
	onOpen,
	getPopupContainer,
}: {
	presentationIndex: FilePresentationIndex
	attachmentLoadState?: AttachmentLoadState
	context: FileHelpContext
	onOpen: (file: AttachmentItem) => void
	getPopupContainer: () => HTMLElement | null
}) {
	const { t } = useTranslation("super")
	const recentFiles = useMemo(() => {
		const selected: RecentFile[] = []
		// 可见索引已包含子目录并去重；只保留前 5 项，避免复制、排序整个附件快照。
		for (const { item: file } of presentationIndex.attachments.entriesById.values()) {
			const id = file.file_id
			if (!id || file.is_directory || file.type === "directory" || file.is_hidden) continue
			const updatedAtValue: unknown = file.updated_at
			const updatedAt = parseFileTime(updatedAtValue)
			if (updatedAt === null) continue
			const before = selected.findIndex(
				(entry) =>
					updatedAt > entry.updatedAt || (updatedAt === entry.updatedAt && id < entry.id),
			)
			const position = before === -1 ? selected.length : before
			if (position >= RECENT_FILES_LIMIT) continue
			if (selected.length === RECENT_FILES_LIMIT) selected.pop()
			selected.splice(position, 0, { file, id, updatedAt })
		}
		return selected
	}, [presentationIndex])
	const sameProject =
		context.kind === "project" && attachmentLoadState?.projectId === context.projectId
	const showFiles = sameProject && recentFiles.length > 0
	// 刷新失败仍保留当前有效快照；状态缺失或属于其它项目时不能展示旧名单。
	const emptyText = !sameProject
		? t("userSpace.loading")
		: attachmentLoadState?.status === "error"
			? t("userSpace.loadFailed")
			: attachmentLoadState?.status === "ready"
				? t("fileManager.recentEmpty")
				: t("userSpace.loading")

	return (
		<div className="mb-3 border-b border-border/60 pb-3">
			<div className="flex items-center gap-2 px-2 pb-1.5 text-[11px] font-medium text-muted-foreground">
				<Clock3 size={13} />
				{t("fileManager.recent")}
			</div>
			{!showFiles ? (
				<p className="px-2 text-[11px] text-muted-foreground">{emptyText}</p>
			) : (
				recentFiles.map(({ file, id }) => {
					const presentation = resolveFilePresentation(file, {
						context,
						index: presentationIndex,
					})
					return (
						<button
							key={id}
							type="button"
							className="flex h-7 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs hover:bg-accent/50"
							onClick={() => onOpen(file)}
						>
							<FileResourceIcon presentation={presentation} size={14} />
							<SmartTooltip
								fileName
								elementType="span"
								className="min-w-0 flex-1 truncate text-xs leading-4"
								placement="bottom"
								sideOffset={4}
								getPopupContainer={getPopupContainer}
							>
								{presentation.name}
							</SmartTooltip>
						</button>
					)
				})
			)}
		</div>
	)
}
