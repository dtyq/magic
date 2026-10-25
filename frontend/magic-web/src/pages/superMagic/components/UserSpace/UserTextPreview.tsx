import { lazy, useEffect, useRef, type ComponentProps } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { DetailType, type TextFileSession } from "../Detail/types"
import type { FileItem } from "../Detail/components/FilesViewer/types"
import { MemoryEditConflictDialog } from "../LongTremMemory/components/MemoryEditConflictDialog"
import { resolveUserFileHref } from "../../utils/markdownFileReference"
import { useFileApi } from "@/pages/superMagic/fileAccess/fileApi"
import {
	getFileReferenceIdentityKey,
	resolveFileReference,
} from "../../services/userFileReferenceResolver"
import { useFileOperations } from "../TopicFilesButton/hooks/useFileOperations"
import { useUserFileEditor } from "./hooks/useUserFileEditor"
import { createUserFilePreview } from "./services/userSpaceFileService"

const Md = lazy(() => import("../Detail/contents/Md"))
const Text = lazy(() => import("../Detail/contents/Text"))
const Code = lazy(() => import("../Detail/contents/Code"))

type UserTextPreviewProps = Omit<ComponentProps<typeof Md>, "data"> & {
	data: FileItem
	isEditMode: boolean
	setIsEditMode: (value: boolean) => void
}

/** 原预览器负责 UI 和关闭保存注册；用户会话只负责稳定快照、草稿和冲突处理。 */
export default observer(function UserTextPreview({ data, ...props }: UserTextPreviewProps) {
	const identityKey = getFileReferenceIdentityKey()
	const fileApi = useFileApi()
	const currentFile = useRef<string | null>(data.file_id)
	currentFile.current = data.file_id
	useEffect(
		() => () => {
			currentFile.current = null
		},
		[],
	)
	const assertCurrent = () => {
		if (currentFile.current !== data.file_id || identityKey !== getFileReferenceIdentityKey())
			throw new DOMException("File changed", "AbortError")
	}
	const editor = useUserFileEditor(data.file_id, props.isEditMode, identityKey)
	const { handleDownloadOriginal } = useFileOperations({
		fileScope: "user",
		isCurrent: () => identityKey === getFileReferenceIdentityKey(),
	})
	const resolveRelativeFile = useMemoizedFn(
		async (href: string): Promise<FileItem | undefined> => {
			assertCurrent()
			const path = data.file_reference?.space_relative_path ?? data.relative_file_path
			const relativePath = path ? resolveUserFileHref(href, path) : null
			if (!relativePath) return undefined
			const result = await resolveFileReference({
				space_type: "user",
				space_relative_path: relativePath,
			})
			assertCurrent()
			if (result.status !== "resolved" || result.reference.space_type !== "user")
				return undefined
			// 相对链接与列表、消息使用同一预览策略；用户文件不依赖项目附件树。
			return createUserFilePreview(result.reference)
		},
	)
	const resolveImageUrl = useMemoizedFn(async (href: string) => {
		const file = await resolveRelativeFile(href)
		if (!file || file.is_directory) return href
		const urls = await fileApi.getTemporaryDownloadUrl({ file_ids: [file.file_id] })
		assertCurrent()
		return urls?.[0]?.url ?? href
	})
	const save = useMemoizedFn(() => editor.save())
	const download = useMemoizedFn(() =>
		handleDownloadOriginal({
			file_id: data.file_id,
			file_name: data.file_name,
			file_extension: data.file_extension,
		}),
	)
	const textFileSession: TextFileSession = {
		content: editor.snapshot?.content ?? "",
		draft: editor.draft,
		loading: editor.loading,
		loadError: editor.loadError,
		saving: editor.saving,
		saveStage: editor.saveStage,
		setDraft: editor.setDraft,
		refresh: editor.load,
		save,
	}
	const Preview = props.type === DetailType.Md ? Md : props.type === DetailType.Text ? Text : Code
	return (
		<>
			<Preview
				{...props}
				data={data}
				{...(props.type === DetailType.Code ? { file_name: data.file_name } : {})}
				textFileSession={textFileSession}
				resolveRelativeFile={resolveRelativeFile}
				resolveImageUrl={resolveImageUrl}
				attachments={undefined}
				attachmentList={undefined}
				selectedProject={undefined}
				onCopy={() => void navigator.clipboard.writeText(textFileSession.content)}
				onDownload={download}
				exportFile={download}
			/>
			<MemoryEditConflictDialog
				open={Boolean(editor.conflict)}
				loading={editor.saving}
				onCancel={() => editor.setConflict(null)}
				onUseLatest={editor.useLatest}
				onMerge={editor.merge}
				onOverwrite={() => {
					void editor.save(editor.conflict?.revision).catch(() => {
						/* 冲突或失败保留草稿。 */
					})
				}}
			/>
		</>
	)
})
