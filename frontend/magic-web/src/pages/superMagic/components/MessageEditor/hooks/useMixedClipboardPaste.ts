import { useEffect, useRef } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type { Editor, JSONContent } from "@/infrastructure/editors/tiptap/react"
import {
	MentionItemType,
	type UploadFileMentionData,
} from "@/components/business/MentionPanel/types"
import magicToast from "@/components/base/MagicToaster/utils"
import { clipboard } from "@/utils/clipboard-helpers"
import type { AddFilesOptions } from "../stores/FileUploadStore"
import type { FileData } from "../types"
import { parseMixedClipboard, type MixedClipboardPart } from "../utils/mixedClipboard"
import {
	createUploadFileMentionAttributes,
	transformUploadFileToProjectFile,
} from "../utils/mention"
import { isWechatChatText } from "../extensions/wechat-chat-history/parser"
import { insertWechatChat } from "../extensions/wechat-chat-history/commands"

interface UseMixedClipboardPasteOptions {
	getEditor: () => Editor | null
	getSessionId: () => string
	getFiles: () => FileData[]
	addFiles: (files: File[], options?: AddFilesOptions) => Promise<unknown>
	cancelPendingUpload: () => void
	isProjectContext: boolean
	onPreparingChange: (preparing: boolean) => void
	wechatChatEnabled?: boolean
	onWechatImported?: (id: string) => void
}

type ClipboardSnapshot = { text: string; html: string }

function buildContent(
	parts: MixedClipboardPart[],
	uploads: ReadonlyMap<File, FileData>,
	isProjectContext: boolean,
): JSONContent[] {
	const paragraphs: JSONContent[] = [{ type: "paragraph", content: [] }]
	const appendText = (text: string): void => {
		text.split("\n").forEach((line, index) => {
			if (index > 0) paragraphs.push({ type: "paragraph", content: [] })
			if (line) paragraphs[paragraphs.length - 1].content?.push({ type: "text", text: line })
		})
	}
	for (const part of parts) {
		if (part.type === "text") {
			appendText(part.text)
			continue
		}
		const fileData = uploads.get(part.file)
		if (!fileData) {
			// 取消、数量限制或准备失败只影响该附件；正文仍保留来源中的文件标记。
			appendText(part.originalText)
			continue
		}
		const attrs = createUploadFileMentionAttributes(fileData)
		if (isProjectContext && fileData.saveResult && !fileData.isCanvasClipboard) {
			attrs.type = MentionItemType.PROJECT_FILE
			attrs.data = transformUploadFileToProjectFile(
				attrs.data as UploadFileMentionData,
				fileData.saveResult,
			)
		} else if (fileData.reportResult) {
			const data = attrs.data as UploadFileMentionData
			data.file_path = fileData.reportResult.file_key
		}
		paragraphs[paragraphs.length - 1].content?.push({ type: "mention", attrs })
	}
	return paragraphs
}

export function useMixedClipboardPaste({
	getEditor,
	getSessionId,
	getFiles,
	addFiles,
	cancelPendingUpload,
	isProjectContext,
	onPreparingChange,
	wechatChatEnabled = false,
	onWechatImported,
}: UseMixedClipboardPasteOptions) {
	const { t } = useTranslation("super")
	const mounted = useRef(true)
	const queue = useRef(Promise.resolve())
	const pending = useRef(new Map<string, number>())
	const currentSessionId = getSessionId()
	const previousSessionId = useRef(currentSessionId)
	useEffect(() => {
		if (previousSessionId.current === currentSessionId) return
		const hadPendingPaste = (pending.current.get(previousSessionId.current) ?? 0) > 0
		previousSessionId.current = currentSessionId
		queue.current = Promise.resolve()
		if (hadPendingPaste) cancelPendingUpload()
		onPreparingChange((pending.current.get(currentSessionId) ?? 0) > 0)
	}, [currentSessionId, cancelPendingUpload, onPreparingChange])
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])

	return useMemoizedFn((data: DataTransfer, files: File[], snapshot?: ClipboardSnapshot) => {
		const editor = getEditor()
		if (!editor || editor.isDestroyed) return
		const sessionId = getSessionId()
		const initialDoc = editor.state.doc
		const selection = { from: editor.state.selection.from, to: editor.state.selection.to }
		// DataTransfer is not guaranteed to remain readable after a delayed Canvas
		// bundle lookup, so use the paste-time snapshot when one was supplied.
		const text = snapshot?.text ?? data.getData("text/plain")
		const html = snapshot?.html ?? data.getData("text/html")
		let textReadFailed = false
		const textFromClipboardApi = !snapshot && !text && !html
		// 必须在 paste 的用户手势内发起读取，不能等目录弹窗或上一批上传结束后再读剪贴板。
		const textPromise =
			snapshot || text || html
				? Promise.resolve(text)
				: clipboard.readText().catch(() => {
						textReadFailed = true
						return ""
					})
		const isCurrent = (): boolean =>
			mounted.current &&
			!editor.isDestroyed &&
			getEditor() === editor &&
			getSessionId() === sessionId
		pending.current.set(sessionId, (pending.current.get(sessionId) ?? 0) + 1)
		onPreparingChange(true)

		const operation = queue.current.then(async () => {
			const resolvedText = await textPromise
			if (!isCurrent()) return
			const content = parseMixedClipboard(resolvedText, html, files, {
				textFromClipboardApi,
			})
			const filesOnly =
				!html &&
				content.parts.every((part) =>
					part.type === "text" ? !part.text.trim() : !part.originalText,
				)
			const addedIds = new Map<File, string>()
			let preparationFailed = false
			try {
				if (files.length)
					await addFiles(files, {
						isCurrent,
						onFileAdded: filesOnly
							? undefined
							: (addedFiles, sourceFiles) => {
									addedFiles.forEach((file, index) =>
										addedIds.set(sourceFiles[index], file.id),
									)
								},
					})
			} catch {
				preparationFailed = true
				if (isCurrent()) magicToast.warning(t("fileUpload.clipboardUploadFailed"))
			}
			if (!isCurrent()) return

			if (textReadFailed) magicToast.info(t("fileUpload.clipboardTextUnavailable"))
			// 纯文件继续使用原插入流程；取消目录选择时不能用文件名替换原选区。
			if (filesOnly) return

			// 图片可能在目录弹窗关闭前上传完毕；从 Store 取最新结果，再一次性插入整段。
			// 这样上传回调不再各自追加节点，也不会把临时占位写进草稿或撤销历史。
			const currentFiles = new Map(getFiles().map((file) => [file.id, file]))
			const uploads = new Map<File, FileData>()
			for (const [source, id] of addedIds) {
				const file = currentFiles.get(id)
				if (file) uploads.set(source, file)
			}
			for (const source of uploads.keys()) {
				if (files.includes(source)) continue
				content.parts.push(
					{ type: "text", text: "\n" },
					{ type: "file", file: source, originalText: source.name },
				)
			}
			const nodes = buildContent(content.parts, uploads, isProjectContext)
			// 等待期间没有编辑时保留原选区；用户已经修改正文时，不覆盖其新输入。
			const range = editor.state.doc.eq(initialDoc)
				? selection
				: { from: editor.state.selection.to, to: editor.state.selection.to }
			if (nodes.some((node) => node.content?.length)) {
				if (wechatChatEnabled && isWechatChatText(resolvedText)) {
					// 无法证明配对时，原记录留在区块，未绑定附件作为独立资料保留，不能挂到最后一条消息。
					const chatNodes = content.ordered
						? nodes
						: buildContent(
								[{ type: "text", text: resolvedText }],
								uploads,
								isProjectContext,
							)
					// 原文件未成为 mention 时记录原因，避免把凭证失败误报为用户没有复制媒体。
					for (const paragraph of chatNodes) {
						if (paragraph.content?.some((node) => node.type === "mention")) continue
						const body =
							paragraph.content?.map((node) => node.text ?? "").join("") ?? ""
						if (!/^\[(图片|视频|文件)\]/.test(body.trim())) continue
						paragraph.attrs = {
							...paragraph.attrs,
							wechatMediaState: preparationFailed
								? "prepareFailed"
								: files.length === 0
									? "markerOnly"
									: !content.ordered
										? "unmatched"
										: "unavailable",
						}
					}
					const id = insertWechatChat(
						editor,
						range,
						chatNodes,
						t("wechatChat.instructionPlaceholder"),
					)
					if (!content.ordered && uploads.size)
						editor.commands.insertContentAt(
							editor.state.doc.content.size,
							buildContent(
								content.parts.filter((part) => part.type === "file"),
								uploads,
								isProjectContext,
							),
						)
					if (id) onWechatImported?.(id)
				} else {
					editor.commands.insertContentAt(range, nodes)
					editor.commands.focus()
				}
			}
			if (!content.ordered) {
				magicToast.info(t("fileUpload.clipboardOrderUnavailable"))
			}
			if (files.some((file) => !uploads.has(file))) {
				magicToast.info(t("fileUpload.clipboardPartialImport"))
			}
		})
		queue.current = operation
			.catch(() => {
				if (isCurrent()) magicToast.warning(t("fileUpload.clipboardImportFailed"))
			})
			.finally(() => {
				const remaining = (pending.current.get(sessionId) ?? 1) - 1
				if (remaining > 0) pending.current.set(sessionId, remaining)
				else pending.current.delete(sessionId)
				if (mounted.current) {
					onPreparingChange((pending.current.get(getSessionId()) ?? 0) > 0)
				}
			})
	})
}
